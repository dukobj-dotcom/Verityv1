/** @type {import("../verity_knowledge_data.js").KnowledgeEntry[]} */
export const GEOGRAPHY_KNOWLEDGE = [
	{
		patterns: [/\bcapital of france\b/, /\bfrance(?:'s)? capital\b/],
		keywords: ["capital", "france", "paris"],
		answers: ["París es la capital de Francia: arte, el Sena y la Torre Eiffel."],
	},
	{
		patterns: [/\bcapital of (?:the )?usa\b/, /\bcapital of america\b/, /\bamerica(?:'s)? capital\b/],
		keywords: ["capital", "usa", "america", "washington"],
		answers: ["Washington, D.C. es la capital de Estados Unidos: no Nueva York, aunque las películas digan otra cosa."],
	},
	{
		patterns: [/\bcapital of (?:the )?uk\b/, /\bcapital of britain\b/, /\bcapital of england\b/],
		keywords: ["capital", "uk", "britain", "england", "london"],
		answers: ["Londres es la capital del Reino Unido: el Big Ben, el Támesis y la lluvia."],
	},
	{
		patterns: [/\bcapital of japan\b/, /\bjapan(?:'s)? capital\b/],
		keywords: ["capital", "japan", "tokyo"],
		answers: ["Tokio es la capital de Japón: neón, trenes puntuales y comida increíble."],
	},
	{
		patterns: [/\bcapital of china\b/, /\bchina(?:'s)? capital\b/],
		keywords: ["capital", "china", "beijing"],
		answers: ["Pekín es la capital de China: historia, política y pato pekinés."],
	},
	{
		patterns: [/\bcapital of (?:south )?korea\b/, /\bkorea(?:'s)? capital\b/],
		keywords: ["capital", "korea", "seoul"],
		answers: ["Seúl es la capital de Corea del Sur: K-pop, tecnología y comida callejera de madrugada."],
	},
	{
		patterns: [/\bcapital of vietnam\b/, /\bvietnam(?:'s)? capital\b/],
		keywords: ["capital", "vietnam", "hanoi"],
		answers: ["Hanói es la capital de Vietnam: lagos, phở al amanecer y mil años de historia."],
	},
	{
		patterns: [/\bcapital of thailand\b/, /\bthailand(?:'s)? capital\b/],
		keywords: ["capital", "thailand", "bangkok"],
		answers: ["Bangkok es la capital de Tailandia: templos, mercados y tráfico legendario."],
	},
	{
		patterns: [/\bcapital of germany\b/, /\bgermany(?:'s)? capital\b/],
		keywords: ["capital", "germany", "berlin"],
		answers: ["Berlín es la capital de Alemania: reunificada, creativa y llena de historia."],
	},
	{
		patterns: [/\bcapital of italy\b/, /\bitaly(?:'s)? capital\b/],
		keywords: ["capital", "italy", "rome"],
		answers: ["Roma es la capital de Italia: el Coliseo, la pasta y dos mil años de capas de historia."],
	},
	{
		patterns: [/\bcapital of spain\b/, /\bspain(?:'s)? capital\b/],
		keywords: ["capital", "spain", "madrid"],
		answers: ["Madrid es la capital de España: museos de arte, tapas y cenas tardías."],
	},
	{
		patterns: [/\bcapital of russia\b/, /\brussia(?:'s)? capital\b/],
		keywords: ["capital", "russia", "moscow"],
		answers: ["Moscú es la capital de Rusia: la Plaza Roja, inviernos fríos y cúpulas de cebolla."],
	},
	{
		patterns: [/\bcapital of canada\b/, /\bcanada(?:'s)? capital\b/],
		keywords: ["capital", "canada", "ottawa"],
		answers: ["Ottawa es la capital de Canadá: política educada y eneros muy fríos."],
	},
	{
		patterns: [/\bcapital of australia\b/, /\baustralia(?:'s)? capital\b/],
		keywords: ["capital", "australia", "canberra"],
		answers: ["Canberra es la capital de Australia: no Sídney; la construyeron a propósito entre ciudades rivales."],
	},
	{
		patterns: [/\bcapital of brazil\b/, /\bbrazil(?:'s)? capital\b/],
		keywords: ["capital", "brazil", "brasilia"],
		answers: ["Brasilia es la capital de Brasil: ciudad modernista planificada; Río se lleva las postales."],
	},
	{
		patterns: [/\bcapital of mexico\b/, /\bmexico(?:'s)? capital\b/],
		keywords: ["capital", "mexico", "mexico city"],
		answers: ["Ciudad de México es la capital de México: enorme, con raíces aztecas antiguas y tacos increíbles."],
	},
	{
		patterns: [/\bcapital of india\b/, /\bindia(?:'s)? capital\b/],
		keywords: ["capital", "india", "delhi", "new delhi"],
		answers: ["Nueva Delhi es la capital de la India: centro de gobierno en un país de más de mil millones de personas."],
	},
	{
		patterns: [/\bcapital of egypt\b/, /\begypt(?:'s)? capital\b/],
		keywords: ["capital", "egypt", "cairo"],
		answers: ["El Cairo es la capital de Egipto: pirámides cerca, tráfico sobre el Nilo y milenios de historia."],
	},
	{
		patterns: [/\bcapital of turkey\b/, /\bturkey(?:'s)? capital\b/],
		keywords: ["capital", "turkey", "ankara"],
		answers: ["Ankara es la capital de Turquía: Estambul se lleva la fama, Ankara el gobierno."],
	},
	{
		patterns: [/\bcapital of argentina\b/, /\bargentina(?:'s)? capital\b/],
		keywords: ["capital", "argentina", "buenos aires"],
		answers: ["Buenos Aires es la capital de Argentina: tango, asado y la tierra de Messi."],
	},
	{
		patterns: [/\bcapital of poland\b/, /\bpoland(?:'s)? capital\b/],
		keywords: ["capital", "poland", "warsaw"],
		answers: ["Varsovia es la capital de Polonia: reconstruida tras la guerra, resiliente y en crecimiento."],
	},
	{
		patterns: [/\bcapital of sweden\b/, /\bsweden(?:'s)? capital\b/],
		keywords: ["capital", "sweden", "stockholm"],
		answers: ["Estocolmo es la capital de Suecia: islas, diseño y el país donde nació Minecraft."],
	},
	{
		patterns: [/\bcapital of norway\b/, /\bnorway(?:'s)? capital\b/],
		keywords: ["capital", "norway", "oslo"],
		answers: ["Oslo es la capital de Noruega: fiordos cerca y vikingos en los museos."],
	},
	{
		patterns: [/\bcapital of netherlands\b/, /\bholland(?:'s)? capital\b/, /\bdutch capital\b/],
		keywords: ["capital", "netherlands", "holland", "amsterdam"],
		answers: ["Ámsterdam es la capital de los Países Bajos: canales, bicicletas y tulipanes."],
	},
	{
		patterns: [/\bcapital of philippines\b/, /\bphilippines(?:'s)? capital\b/],
		keywords: ["capital", "philippines", "manila"],
		answers: ["Manila es la capital de Filipinas: ciudad portuaria ajetreada en la isla de Luzón."],
	},
	{
		patterns: [/\bcapital of indonesia\b/, /\bindonesia(?:'s)? capital\b/],
		keywords: ["capital", "indonesia", "jakarta"],
		answers: ["Yakarta es la capital de Indonesia: islas, tráfico y nasi goreng."],
	},
];
