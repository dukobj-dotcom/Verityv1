const MATH_LEAD =
	/^(?:what(?:'s| is)|whats|how much is|calculate|compute|solve|evaluate|work out|find)\s+/i;

const MATH_LEAD_ANYWHERE =
	/\b(?:what(?:'s| is)|whats|how much is|calculate|compute|solve|evaluate|work out|find)\s+/i;

const VERITY_PREFIX = /^(?:hey\s+)?verity\s*[,!.:;\s]+/i;

const WORD_OPS = [
	[/\bplus\b/gi, "+"],
	[/\bminus\b/gi, "-"],
	[/\btimes\b/gi, "*"],
	[/\bmultiplied by\b/gi, "*"],
	[/\bdivided by\b/gi, "/"],
	[/\bover\b/gi, "/"],
];

const RAW_MATH_HINT =
	/\d[\d.]*\s*(?:[+\-*/^()]|[+\-*/^()]\s*\d)|(?:plus|minus|times|divided by|multiplied by|over)\b/i;

/**
 * @param {string} text
 */
function normalizeMathOperators(text) {
	return text
		.replace(/[\uFF0B\u2212\u00D7\u00F7]/g, (ch) => {
			if (ch === "\uFF0B") return "+";
			if (ch === "\u2212") return "-";
			if (ch === "\u00D7") return "*";
			if (ch === "\u00F7") return "/";
			return ch;
		});
}

/**
 * @param {string} fragment
 * @param {boolean} [allowPlainNumber]
 * @returns {string | null}
 */
function parseMathFragment(fragment, allowPlainNumber = false) {
	let text = normalizeMathOperators(fragment.trim()).replace(/\?+$/, "").trim();

	for (const [pattern, symbol] of WORD_OPS) {
		text = text.replace(pattern, ` ${symbol} `);
	}

	text = text.replace(/\s+/g, "");

	if (!/\d/.test(text)) return null;
	if (!/^[\d+\-*/().^%]+$/.test(text)) return null;
	if (!/[+\-*/^()]/.test(text)) {
		if (!allowPlainNumber && !/^[\d.]+$/.test(text)) return null;
	}

	return text.length > 0 ? text : null;
}

/**
 * @param {string} message
 */
export function looksLikeMath(message) {
	const raw = normalizeMathOperators(message.trim());
	if (!raw) return false;
	if (MATH_LEAD.test(raw) && /\d/.test(raw)) return true;
	if (VERITY_PREFIX.test(raw) && MATH_LEAD_ANYWHERE.test(raw) && /\d/.test(raw)) {
		return true;
	}
	if (MATH_LEAD_ANYWHERE.test(raw) && /\d/.test(raw) && RAW_MATH_HINT.test(raw)) {
		return true;
	}
	if (RAW_MATH_HINT.test(raw)) return true;
	if (/^(?:hey\s+verity[,?\s]*)?\d[\d.]*\s*(?:plus|minus|times|divided by)\b/i.test(raw)) {
		return true;
	}
	return false;
}

/**
 * @param {string} message
 * @returns {string | null}
 */
function extractMathExpression(message) {
	const raw = normalizeMathOperators(message.trim());
	if (!raw) return null;

	let text = raw.replace(VERITY_PREFIX, "");
	const hadMathLead = MATH_LEAD.test(text) || MATH_LEAD_ANYWHERE.test(text);

	let expr = parseMathFragment(text.replace(MATH_LEAD, ""), hadMathLead);
	if (expr) return expr;

	const embedded = text.match(
		/\b(?:what(?:'s| is)|whats|how much is|calculate|compute|solve|evaluate|work out|find)\s+(.+?)\s*\??$/i,
	);
	if (embedded) {
		expr = parseMathFragment(embedded[1], true);
		if (expr) return expr;
	}

	const bare = text.match(/(\d[\d.]*(?:\s*[+\-*/^]\s*\d[\d.]*)+)/);
	if (bare) {
		expr = parseMathFragment(bare[1], false);
		if (expr) return expr;
	}

	return null;
}

/**
 * @typedef {{ type: "num", value: number } | { type: "op", value: string }} MathToken
 */

/**
 * @param {string} expr
 * @returns {MathToken[] | null}
 */
function tokenizeMath(expr) {
	/** @type {MathToken[]} */
	const tokens = [];
	let i = 0;

	while (i < expr.length) {
		const c = expr[i];
		if ((c >= "0" && c <= "9") || c === ".") {
			let raw = "";
			while (i < expr.length && /[\d.]/.test(expr[i])) {
				raw += expr[i++];
			}
			const value = Number(raw);
			if (!Number.isFinite(value)) return null;
			tokens.push({ type: "num", value });
			continue;
		}
		if ("+-*/^()".includes(c)) {
			tokens.push({ type: "op", value: c });
			i++;
			continue;
		}
		return null;
	}

	return tokens;
}

/**
 * Safe math evaluator (no Function/eval). Supports + - * / ^ and parentheses.
 * @param {string} expr
 * @returns {number | null}
 */
function evaluateMath(expr) {
	const tokens = tokenizeMath(expr.replace(/\^/g, "^"));
	if (!tokens?.length) return null;

	let index = 0;

	/**
	 * @returns {number | null}
	 */
	function parseExpression() {
		let value = parseTerm();
		if (value === null) return null;
		while (index < tokens.length) {
			const token = tokens[index];
			if (token.type !== "op" || (token.value !== "+" && token.value !== "-")) break;
			index++;
			const rhs = parseTerm();
			if (rhs === null) return null;
			value = token.value === "+" ? value + rhs : value - rhs;
		}
		return value;
	}

	/**
	 * @returns {number | null}
	 */
	function parseTerm() {
		let value = parsePower();
		if (value === null) return null;
		while (index < tokens.length) {
			const token = tokens[index];
			if (token.type !== "op" || (token.value !== "*" && token.value !== "/")) break;
			index++;
			const rhs = parsePower();
			if (rhs === null) return null;
			if (token.value === "/" && rhs === 0) return null;
			value = token.value === "*" ? value * rhs : value / rhs;
		}
		return value;
	}

	/**
	 * @returns {number | null}
	 */
	function parsePower() {
		let value = parseUnary();
		if (value === null) return null;
		if (index < tokens.length && tokens[index].type === "op" && tokens[index].value === "^") {
			index++;
			const rhs = parsePower();
			if (rhs === null) return null;
			value = value ** rhs;
		}
		return value;
	}

	/**
	 * @returns {number | null}
	 */
	function parseUnary() {
		const token = tokens[index];
		if (token?.type === "op" && token.value === "-") {
			index++;
			const value = parseUnary();
			return value === null ? null : -value;
		}
		return parsePrimary();
	}

	/**
	 * @returns {number | null}
	 */
	function parsePrimary() {
		const token = tokens[index];
		if (!token) return null;

		if (token.type === "num") {
			index++;
			return token.value;
		}

		if (token.type === "op" && token.value === "(") {
			index++;
			const value = parseExpression();
			if (value === null) return null;
			const close = tokens[index];
			if (!close || close.type !== "op" || close.value !== ")") return null;
			index++;
			return value;
		}

		return null;
	}

	const result = parseExpression();
	if (result === null || index !== tokens.length) return null;
	if (!Number.isFinite(result)) return null;
	return result;
}

/**
 * @param {number} value
 */
function formatNumber(value) {
	if (Number.isInteger(value)) return String(value);
	return String(Math.round(value * 1_000_000) / 1_000_000);
}

/**
 * @param {string} message
 * @returns {string | null}
 */
export function tryMathAnswer(message) {
	if (!looksLikeMath(message)) return null;

	const expr = extractMathExpression(message);
	if (!expr) return null;

	const value = evaluateMath(expr);
	if (value === null) return null;

	const shown = formatNumber(value);
	const lines = [
		`${shown}.`,
		`Eso es ${shown}.`,
		`Me da ${shown}.`,
		`${expr.replace(/\*\*/g, "^")} = ${shown}.`,
	];
	return lines[Math.floor(Math.random() * lines.length)];
}
