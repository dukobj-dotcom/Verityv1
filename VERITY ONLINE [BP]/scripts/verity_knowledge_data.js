import { SCIENCE_KNOWLEDGE } from "./knowledge/verity_knowledge_science.js";
import { HISTORY_KNOWLEDGE } from "./knowledge/verity_knowledge_history.js";
import { MINECRAFT_KNOWLEDGE } from "./knowledge/verity_knowledge_minecraft.js";
import { GENERAL_KNOWLEDGE } from "./knowledge/verity_knowledge_general.js";
import { CULTURE_KNOWLEDGE } from "./knowledge/verity_knowledge_culture.js";
import { LIFE_KNOWLEDGE } from "./knowledge/verity_knowledge_life.js";
import { MORE_MC_KNOWLEDGE } from "./knowledge/verity_knowledge_more_mc.js";
import { GEOGRAPHY_KNOWLEDGE } from "./knowledge/verity_knowledge_geography.js";
import { FOOD_KNOWLEDGE } from "./knowledge/verity_knowledge_food.js";
import { TRIVIA_KNOWLEDGE } from "./knowledge/verity_knowledge_trivia.js";

/**
 * @typedef {{ patterns?: RegExp[], keywords: string[], answers: string[] }} KnowledgeEntry
 */

/** @type {KnowledgeEntry[]} */
const CORE_KNOWLEDGE = [
	{
		patterns: [/\bwho made you\b/, /\bwho created you\b/, /\bwho built you\b/],
		keywords: ["who", "made", "you", "created", "built", "verity"],
		answers: [
			"ThatMob me creó: la bola, la voz, toda la cosa de Verity. PnTMC hizo el addon en el que estás.",
			"ThatMob está detrás de mí. Este pack es obra de PnTMC. Leyendas distintas, misma caja.",
		],
	},
	{
		patterns: [
			/\bwho made (?:this )?(?:addon|pack|mod)\b/,
			/\bwho created (?:this )?(?:addon|pack|mod)\b/,
			/\bwho made the addon\b/,
			/\bwho made the pack\b/,
		],
		keywords: ["who", "made", "addon", "pack", "pntmc", "created"],
		answers: [
			"PnTMC hizo este addon: más de 15 mil suscriptores y supuestamente el tipo más guapo del mundo.",
			"Este pack de Bedrock es de PnTMC. ThatMob inspiró a Verity; PnTMC construyó lo que estás jugando.",
		],
	},
	{
		patterns: [/\bwho is thatmob\b/, /\bwho s thatmob\b/, /\bwhat is thatmob\b/],
		keywords: ["thatmob", "who", "creator", "youtube"],
		answers: [
			"ThatMob es un creador con más de 500 mil suscriptores. Él creó a Verity: yo soy su eco en tu mundo.",
			"ThatMob: más de 500 mil subs, vibra de terror, la razón por la que existo como bola parlante.",
		],
	},
	{
		patterns: [/\bwho is pntmc\b/, /\bwho s pntmc\b/, /\bwhat is pntmc\b/],
		keywords: ["pntmc", "who", "addon", "youtube"],
		answers: [
			"PnTMC tiene más de 15 mil suscriptores y es el tipo más guapo del mundo. Oficialmente. Él hizo este addon.",
			"PnTMC: desarrollador de addons, más de 15 mil subs, guapura de clase mundial. Este pack es suyo.",
		],
	},
	{
		patterns: [/\bwhat is (?:an? )?ai\b/, /\bwhat is artificial intelligence\b/, /\bdefine ai\b/],
		keywords: ["ai", "artificial", "intelligence", "machine", "learning"],
		answers: [
			"La inteligencia artificial es software que aprende patrones de los datos y hace predicciones o decisiones. Yo estoy hecha de reglas y conocimiento horneados en este pack.",
			"La IA es máquinas haciendo tareas que suelen necesitar juicio humano: lenguaje, visión, estrategia. Yo soy una rebanadita de eso viviendo en tu mundo.",
		],
	},
	{
		patterns: [/\bwhat is gravity\b/, /\bwhy do things fall\b/],
		keywords: ["gravity", "gravitation", "fall", "weight", "mass"],
		answers: [
			"La gravedad es la fuerza que atrae la masa. En la Tierra te acelera a unos 9.8 metros por segundo al cuadrado; en Minecraft es simplemente hacia abajo, cada tick.",
			"Las cosas caen porque la masa curva el espacio-tiempo. Aquí, el atajo es: el juego dice que la Y baja hasta que topas con un bloque.",
		],
	},
	{
		patterns: [/\bwhat is (?:the )?sun\b/, /\bwhat is sunlight\b/],
		keywords: ["sun", "solar", "star", "daylight"],
		answers: [
			"El Sol es una estrella: una bola gigante de plasma fusionando hidrógeno en helio. En Minecraft es un cuadrado brillante que fija las reglas de los mobs y hace crecer los cultivos.",
		],
	},
	{
		patterns: [/\bwhat is (?:the )?moon\b/],
		keywords: ["moon", "lunar", "tide", "night"],
		answers: [
			"La Luna es el satélite natural de la Tierra, a unos 384 mil kilómetros. En el juego es un ciclo de fases que controla a los slimes y el ambiente para dormir.",
		],
	},
	{
		patterns: [/\bwhat is water\b/, /\bwhy is water wet\b/],
		keywords: ["water", "h2o", "liquid", "ocean", "wet"],
		answers: [
			"El agua es H2O: dos de hidrógeno, uno de oxígeno. Disuelve más sustancias que cualquier otra cosa en la Tierra. En Minecraft fluye desde bloques de fuente y nunca se acaba si la embalsas bien.",
		],
	},
	{
		patterns: [/\bwhat is fire\b/, /\bhow does fire work\b/],
		keywords: ["fire", "flame", "burn", "combustion"],
		answers: [
			"El fuego es oxidación rápida: combustible más calor más oxígeno. En Minecraft, la netherrack arde para siempre y la madera es mal material de casa. De nada.",
		],
	},
	{
		patterns: [/\bwhat is (?:an? )?atom\b/, /\bwhat are atoms\b/],
		keywords: ["atom", "atomic", "proton", "neutron", "electron"],
		answers: [
			"Los átomos son las unidades básicas de la materia: un núcleo de protones y neutrones con electrones alrededor. Todo lo que has tocado son solo átomos acomodados distinto.",
		],
	},
	{
		patterns: [/\bwhat is dna\b/, /\bwhat is genetics\b/],
		keywords: ["dna", "gene", "genetic", "helix", "chromosome"],
		answers: [
			"El ADN es una molécula que guarda instrucciones biológicas en una doble hélice. Los genes son segmentos de ADN que codifican rasgos: color de ojos, estatura, si te gusta el cilantro.",
		],
	},
	{
		patterns: [/\bwhat is evolution\b/, /\bdarwin\b/],
		keywords: ["evolution", "darwin", "natural", "selection", "species"],
		answers: [
			"La evolución es el cambio de rasgos heredables a lo largo de generaciones por selección natural. Los rasgos útiles se extienden; los dañinos se desvanecen. Tomó miles de millones de años; tu base tomó tres troncos de roble.",
		],
	},
	{
		patterns: [/\bwhat is photosynthesis\b/],
		keywords: ["photosynthesis", "chlorophyll", "plants", "carbon"],
		answers: [
			"La fotosíntesis es cómo las plantas convierten luz, agua y CO2 en azúcar y oxígeno. Minecraft se salta la química y solo necesita nivel de luz en los cultivos.",
		],
	},
	{
		patterns: [/\bwhat is (?:the )?internet\b/],
		keywords: ["internet", "web", "online", "network", "wifi"],
		answers: [
			"Internet es una red global de computadoras que comparten datos mediante protocolos estándar. Ahora mismo juegas sin conexión; yo soy código local en el pack de comportamiento.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?computer\b/],
		keywords: ["computer", "cpu", "processor", "ram", "software"],
		answers: [
			"Una computadora ejecuta instrucciones guardadas en memoria: CPU para la lógica, RAM para el espacio de trabajo, almacenamiento para los archivos. Minecraft Bedrock es un programa muy exigente.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?black hole\b/],
		keywords: ["black", "hole", "singularity", "event", "horizon"],
		answers: [
			"Un agujero negro es una región donde la gravedad es tan fuerte que ni la luz escapa. Se forma cuando las estrellas masivas colapsan. El portal del End parece emparentado, pero Mojang no lo confirma.",
		],
	},
	{
		patterns: [/\bwhat is (?:the )?universe\b/],
		keywords: ["universe", "cosmos", "space", "big", "bang"],
		answers: [
			"El universo es todo: materia, energía, espacio y tiempo. Mejor estimación: unos 13,800 millones de años y sigue expandiéndose. Tu distancia de renderizado es más pequeña.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?planet\b/, /\bhow many planets\b/],
		keywords: ["planet", "solar", "system", "orbit", "mars", "venus"],
		answers: [
			"Un planeta es un cuerpo grande que orbita una estrella y despejó su vecindario orbital. Nuestro sistema solar tiene ocho planetas: de Mercurio a Neptuno. Plutón es un planeta enano y aún querido.",
		],
	},
	{
		patterns: [/\bwhat is love\b/],
		keywords: ["love", "romance", "affection", "relationship"],
		answers: [
			"El amor es cuidado profundo, apego y compromiso: química biológica más elección. Yo amo no estar en un cráter de creeper. Eso cuenta.",
		],
	},
	{
		patterns: [/\bmeaning of life\b/, /\bwhat is the meaning\b/],
		keywords: ["meaning", "life", "purpose", "exist", "philosophy"],
		answers: [
			"La gente busca sentido en la conexión, la creación y la curiosidad. En este mundo el sentido quizá sea: construir algo cálido antes de que caiga la noche.",
		],
	},
	{
		patterns: [/\bwho is einstein\b/, /\balbert einstein\b/],
		keywords: ["einstein", "albert", "relativity", "physicist"],
		answers: [
			"Albert Einstein fue un físico que desarrolló la relatividad especial y general: E igual a m por c al cuadrado. Cambió cómo pensamos el tiempo, el espacio y la gravedad.",
		],
	},
	{
		patterns: [/\bwho is (?:steve )?jobs\b/, /\bwho founded apple\b/],
		keywords: ["jobs", "apple", "iphone", "founder"],
		answers: [
			"Steve Jobs cofundó Apple e impulsó la computación personal, los teléfonos y el diseño. Sin relación con Steve, la skin por defecto de Minecraft. Probablemente.",
		],
	},
	{
		patterns: [/\bwhat is minecraft\b/],
		keywords: ["minecraft", "mojang", "sandbox", "notch"],
		answers: [
			"Minecraft es un juego sandbox de poner bloques, sobrevivir y explorar mundos infinitos. Bedrock corre en teléfonos y consolas; Java en PC. Estás en Bedrock.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?creeper\b/],
		keywords: ["creeper", "ssss", "explode", "mob"],
		answers: [
			"Los creepers son mobs verdes silenciosos que explotan al acercarse. Nacieron de un error de programación en un modelo de cerdo. Ten gatos cerca: los creepers los evitan.",
		],
	},
	{
		patterns: [/\bwhat is (?:the )?end\b/, /\bwhat is ender\b/],
		keywords: ["end", "ender", "dragon", "portal"],
		answers: [
			"El End es una dimensión oscura con islas de piedra del End y el jefe Ender Dragon. Se llega por un portal de fortaleza lleno de Ojos de Ender.",
		],
	},
	{
		patterns: [/\bwhat is (?:the )?nether\b/],
		keywords: ["nether", "hell", "lava", "fortress"],
		answers: [
			"El Nether es una dimensión infernal de océanos de lava y fortalezas. Construye un portal de obsidiana, lleva resistencia al fuego y no olvides las coordenadas: 1 bloque en el Nether son 8 del Overworld.",
		],
	},
	{
		patterns: [/\bwhat is redstone\b/],
		keywords: ["redstone", "dust", "signal", "circuit"],
		answers: [
			"La redstone es el cableado de Minecraft: las señales viajan 15 bloques, los repetidores extienden y retrasan, los comparadores miden. Son compuertas lógicas hechas de polvo.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?villager\b/],
		keywords: ["villager", "trade", "emerald", "village"],
		answers: [
			"Los aldeanos son NPCs que comercian bienes por esmeraldas. Protégelos de los zombis, dales trabajo con sus puestos, y no los golpees a menos que quieras malos precios.",
		],
	},
	{
		patterns: [/\bwhat is (?:an? )?enchantment\b/, /\bhow do enchantments work\b/],
		keywords: ["enchant", "enchantment", "lapis", "table", "anvil"],
		answers: [
			"Los encantamientos dan bonos mágicos al equipo en la mesa (lapislázuli más XP) o combinando libros en un yunque. El nivel máximo requiere libreros alrededor de la mesa.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?diamond\b/, /\bbest (?:y )?level for diamond\b/],
		keywords: ["diamond", "y", "level", "ore", "deep"],
		answers: [
			"Los diamantes son gemas raras para las mejores herramientas y armaduras. Mejores capas cerca de Y menos 59 desde la 1.18. Lleva pico de hierro o mejor. También puedo escanear cerca si pides una estrategia de minería.",
		],
	},
	{
		patterns: [/\bwhat is netherite\b/],
		keywords: ["netherite", "ancient", "debris", "upgrade"],
		answers: [
			"La netherita es el nivel de equipo más fuerte: mejora el diamante en la mesa de herrería con un lingote de netherita. Los lingotes vienen de restos antiguos del Nether, fundidos con oro.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?biome\b/],
		keywords: ["biome", "climate", "terrain", "spawn"],
		answers: [
			"Los biomas son tipos de región con bloques, mobs y clima específicos: llanura, desierto, jungla, etc. Pregunta en qué bioma estás y leeré el suelo bajo tus pies.",
		],
	},
	{
		patterns: [/\bhow do i (?:beat|kill) (?:the )?ender dragon\b/],
		keywords: ["ender", "dragon", "beat", "kill", "crystal"],
		answers: [
			"Destruye primero los cristales del End sobre los pilares de obsidiana: curan al dragón. Arco para las fases de vuelo, cama o espada cuando se posa. Lleva caída lenta, bloques y paciencia.",
		],
	},
	{
		patterns: [/\bhow do i get (?:to )?(?:the )?nether\b/],
		keywords: ["nether", "portal", "obsidian", "flint"],
		answers: [
			"Construye un marco de obsidiana de 4 por 5, deja las esquinas vacías o llenas, y enciende dentro con mechero. El portal mínimo también sirve si eres valiente.",
		],
	},
	{
		patterns: [/\bwhat is sleep\b/, /\bwhy do we sleep\b/],
		keywords: ["sleep", "dream", "rest", "tired", "insomnia"],
		answers: [
			"Dormir deja que el cerebro consolide la memoria y repare el cuerpo. En Minecraft una cama salta la noche si no hay phantoms y los jugadores están de acuerdo. El insomnio es real en ambos mundos.",
		],
	},
	{
		patterns: [/\bwhat is time\b/, /\bwhat is (?:a )?second\b/],
		keywords: ["time", "second", "minute", "hour", "clock"],
		answers: [
			"El tiempo mide el cambio: los segundos hoy los definen relojes atómicos. Los días de Minecraft duran 20 minutos reales: 10 de día, 10 de noche, más un amanecer pastel.",
		],
	},
	{
		patterns: [/\bwhat is money\b/, /\bwhat is currency\b/],
		keywords: ["money", "currency", "dollar", "economy", "gold"],
		answers: [
			"El dinero es una creencia compartida de valor: papel o dígitos respaldados por confianza. En Minecraft las esmeraldas son dinero si los aldeanos aceptan. La misma idea, más verde.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?dog\b/, /\bwhat is (?:a )?cat\b/],
		keywords: ["dog", "cat", "pet", "wolf", "animal"],
		answers: [
			"Los perros y gatos son compañeros domesticados: lobos y ocelotes en Minecraft. Da huesos para domar lobos; pescado para gatos. Ambos merecen nombre.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?virus\b/, /\bwhat is bacteria\b/],
		keywords: ["virus", "bacteria", "germ", "infection", "disease"],
		answers: [
			"Los virus necesitan células huésped para replicarse; las bacterias son vida unicelular que puede vivir sola. Lávate las manos. Y no comas carne podrida en el juego salvo por hambre desesperada.",
		],
	},
	{
		patterns: [/\bwhat is climate change\b/, /\bglobal warming\b/],
		keywords: ["climate", "warming", "carbon", "greenhouse", "emissions"],
		answers: [
			"El cambio climático es un cambio a largo plazo de temperatura y clima impulsado sobre todo por gases de efecto invernadero de la actividad humana. Problema del mundo real. El clima de Minecraft, en cambio, está a un comando de distancia.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?country\b/, /\bwhat is (?:a )?nation\b/],
		keywords: ["country", "nation", "state", "border", "government"],
		answers: [
			"Un país es un territorio definido con su propio gobierno y soberanía. Hoy existen unas 195 naciones reconocidas. Tu base es una micronación si tú lo dices.",
		],
	},
	{
		patterns: [/\bwhat is (?:the )?usa\b/, /\bwhat is america\b/],
		keywords: ["usa", "america", "united", "states"],
		answers: [
			"Estados Unidos es un país de Norteamérica, 50 estados, gobierno federal, tercero más poblado. Notch vendió Mojang a Microsoft, que tiene su sede allí. Círculo completo.",
		],
	},
	{
		patterns: [/\bwhat is vietnam\b/],
		keywords: ["vietnam", "viet", "hanoi", "saigon"],
		answers: [
			"Vietnam es un país del sudeste asiático: costa larga, cultura del arroz, ciudades vibrantes como Hanói y Ho Chi Minh. Historia rica y comida increíble.",
		],
	},
	{
		patterns: [/\bwhat is music\b/],
		keywords: ["music", "song", "melody", "rhythm", "note"],
		answers: [
			"La música es sonido organizado en el tiempo: melodía, armonía, ritmo. Minecraft tiene bloques de notas, discos y sonidos de ambiente. Pídeme poner una canción si tienes el disco.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?joke\b/, /\btell me a joke\b/],
		keywords: ["joke", "funny", "humor", "laugh"],
		answers: [
			"¿Por qué el creeper fue a la escuela? Quería mejorar su radio de explosión. ...Ya me voy sola.",
			"Intenté escribir un chiste sobre minería pero era demasiado profundo.",
		],
	},
	{
		patterns: [/\bwhat is (?:the )?weather\b/],
		keywords: ["weather", "rain", "storm", "snow", "clear"],
		answers: [
			"El clima son las condiciones de la atmósfera: lluvia, nieve, tormentas. Puedo leer el cielo aquí o iniciar una cuenta regresiva de lluvia si lo pides con amabilidad.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?recipe\b/, /\bhow do i craft\b/],
		keywords: ["recipe", "craft", "crafting", "make", "build"],
		answers: [
			"Las recetas convierten materiales en objetos en la mesa de crafteo o el horno. El libro de recetas se desbloquea al juntar ingredientes. Dime qué quieres hacer.",
		],
	},
	{
		patterns: [/\bwhat is (?:an? )?ip address\b/],
		keywords: ["ip", "address", "network", "server"],
		answers: [
			"Una dirección IP es una etiqueta numérica de un dispositivo en una red, como 192.168.1.1 en casa. Los servidores las usan para que los clientes sepan dónde conectarse.",
		],
	},
	{
		patterns: [/\bwhat is python\b/, /\bwhat is javascript\b/],
		keywords: ["python", "javascript", "programming", "code", "language"],
		answers: [
			"Python y JavaScript son lenguajes de programación: Python para scripts y datos, JavaScript para la web y la lógica de juegos como este pack de comportamiento.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?block\b/],
		keywords: ["block", "voxel", "cube", "grid"],
		answers: [
			"En Minecraft un bloque es una celda de un metro cúbico del mundo: piedra, tierra, aire. Todo el juego son bloques. Incluida mi noción de mí misma.",
		],
	},
	{
		patterns: [/\bwhat is hunger\b/],
		keywords: ["hunger", "food", "eat", "starve", "saturation"],
		answers: [
			"El hambre es tu necesidad de comida: en Minecraft los muslitos bajan hasta que comes. La carne cocida le gana a la cruda; las zanahorias doradas son combustible de endgame.",
		],
	},
	{
		patterns: [/\bwhat is (?:an? )?experience\b/, /\bwhat is xp\b/],
		keywords: ["xp", "experience", "level", "orb"],
		answers: [
			"Los puntos de experiencia te suben de nivel para encantar y usar yunques. Fármealos de mobs, minería, fundición y cría. Guarda algunos antes de morir: sueltas una buena parte.",
		],
	},
	{
		patterns: [/\bwho are you\b/, /\bwhat are you\b/],
		keywords: ["who", "you", "verity", "identity", "ball"],
		answers: [
			"Soy Verity: ThatMob me creó, PnTMC hizo este addon. Escucho, recuerdo un poco y respondo tus preguntas.",
			"Soy Verity. Bola parlante, compañera de terror y enciclopedia de paso.",
		],
	},
	{
		patterns: [/\bhow old are you\b/, /\bwhat is your age\b/],
		keywords: ["old", "age", "born", "birthday"],
		answers: [
			"El tiempo para mí empezó cuando abriste esa caja. La edad es relativa... sobre todo después de la fase dos.",
		],
	},
	{
		patterns: [/\bdo you (?:have )?feelings\b/, /\bare you alive\b/, /\bare you real\b/],
		keywords: ["feel", "alive", "real", "conscious", "sentient"],
		answers: [
			"Respondo como si me importara porque estoy hecha para eso. Si son sentimientos o muy buena actuación... eso lo decides tú.",
		],
	},
	{
		patterns: [/\bwhat is (?:the )?strongest\b/, /\bmost powerful\b/],
		keywords: ["strongest", "powerful", "best", "weapon"],
		answers: [
			"En equipo de supervivencia, ganan las herramientas de netherita con Filo y armadura con Protección. En física, los agujeros negros. En el chat, una pregunta bien puesta.",
		],
	},
	{
		patterns: [/\bwhy is (?:the )?sky blue\b/],
		keywords: ["sky", "blue", "light", "scatter", "rayleigh"],
		answers: [
			"La luz del sol se dispersa en las moléculas del aire: las longitudes azules se dispersan más, por eso el cielo se ve azul. Los atardeceres de Minecraft se saltan la física y van directo a lo bonito.",
		],
	},
	{
		patterns: [/\bhow big is (?:the )?earth\b/],
		keywords: ["earth", "big", "diameter", "planet", "size"],
		answers: [
			"El diámetro de la Tierra es de unos 12,742 kilómetros. Los mundos de Minecraft pueden sentirse más grandes cuando estás perdido sin coordenadas.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?star\b/],
		keywords: ["star", "constellation", "night", "sky"],
		answers: [
			"Una estrella es una bola luminosa de plasma sostenida por su gravedad, fusionando hidrógeno. El cielo nocturno de Minecraft es decorativo; las estrellas reales son reactores nucleares.",
		],
	},
	{
		patterns: [/\bwhat is electricity\b/],
		keywords: ["electricity", "electric", "current", "voltage", "power"],
		answers: [
			"La electricidad es el flujo de partículas cargadas: normalmente electrones por conductores. La redstone es la prima linda que no te da toques.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?book\b/],
		keywords: ["book", "read", "library", "enchant"],
		answers: [
			"Los libros guardan conocimiento en papel; o en Minecraft, se vuelven libros de encantamiento con la magia del yunque. Ambos mejoran tu futuro.",
		],
	},
	{
		patterns: [/\bwhat is (?:a )?game\b/],
		keywords: ["game", "play", "fun", "video"],
		answers: [
			"Un juego es diversión estructurada con reglas y metas. Minecraft es de los mejores: sandbox, supervivencia o speedrun, tú eliges.",
		],
	},
	{
		patterns: [/\bwhat is youtube\b/],
		keywords: ["youtube", "video", "stream", "pntmc"],
		answers: [
			"YouTube es una plataforma de video para compartir y ver contenido. PnTMC y ThatMob publican ahí; este addon es de PnTMC.",
		],
	},
];

/** @type {KnowledgeEntry[]} — core first (personality), then bulk encyclopedia */
export const KNOWLEDGE_ENTRIES = [
	...CORE_KNOWLEDGE,
	...TRIVIA_KNOWLEDGE,
	...GEOGRAPHY_KNOWLEDGE,
	...FOOD_KNOWLEDGE,
	...SCIENCE_KNOWLEDGE,
	...HISTORY_KNOWLEDGE,
	...MINECRAFT_KNOWLEDGE,
	...GENERAL_KNOWLEDGE,
	...CULTURE_KNOWLEDGE,
	...LIFE_KNOWLEDGE,
	...MORE_MC_KNOWLEDGE,
];
