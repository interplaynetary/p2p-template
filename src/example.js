// Import Node if you're using modules
import { Node } from './models/Node.js';

// Export the initialization function
export async function initializeExampleData(app) {

        // Initialize data structure
        const environmentalist = new Node('environmentalist');
        const researcher = new Node('researcher', null, [environmentalist]);
        const educator = new Node('educator', null, [environmentalist]);

        // Our main nodes with multiple types
        const clownsWithoutBorders = new Node('clowns4all', null, [environmentalist]);
        const whalewatch = new Node('whalewatch', null, [researcher]);  // is a contributor
        const alice = new Node('alice', null, [researcher]);  // is a contributor

        // 1. Material Needs & Dependencies
        const space = await app.addChild("Space & Environment", 25);

        // Space & Environment children
        const indoorSpace = await space.addChild("Indoor/Outdoor Space", 15);
        const seating = await space.addChild("Comfortable Seating", 15);
        const lighting = await space.addChild("Lighting", 12);
        const temperature = await space.addChild("Temperature Control", 12);
        const bathroom = await space.addChild("Bathroom Access", 12);
        const waterAccess = await space.addChild("Water Access", 12);
        const cleaning = await space.addChild("Cleaning Supplies", 11);
        const waste = await space.addChild("Trash/Recycling", 11);
        
        const hosts = await indoorSpace.addChild("Space Providers/Hosts", 14);
        const infrastructure = await indoorSpace.addChild("Infra(de)structure & Bottom-secret Spaces", 25);

        // Main Categories with their percentage weights
        const subverse = await app.addChild("Subverse 🌌", 25);

        const magicalTech = await subverse.addChild("Magical Technologies & Systems", 25);
        const substances = await subverse.addChild("Transformative Substances", 20);
        const realityHacking = await subverse.addChild("Reality Hacking & Manifestation", 20);
        const loreSystem = await subverse.addChild("Lore & Knowledge Systems", 10);

        const money = await app.addChild("Money", 10)
        const freeAssociation = await app.addChild("Free Association", 10)

        const automation = await app.addChild("Automation of Useful-repetitive Tasks", 10)
        const commons = await app.addChild("Socialization of Land & Means of Production", 10)
        const property = await app.addChild("Maintaining Personal Property Relations", 10)
        const securingLaptop = await property.addChild("Securing my Laptop", 10)
        const securingBackpack = await property.addChild("Securing my Backpack", 10)

        const openCollective = await money.addChild("Playnet Open Collective", 10)
        const personalDonations = await money.addChild("Personal Donations", 10)

        const development = await freeAssociation.addChild("Development", 10)
        const communications = await freeAssociation.addChild("Communications", 10)

        // Underground Networks contributions
        const secretStairs = await infrastructure.addChild("Secret stairways", 10, [alice]);
        const wellsTunnels = await infrastructure.addChild("Wells & tunnels", 8, [clownsWithoutBorders]);
        const basements = await infrastructure.addChild("Basements", 7, [alice]);
        const subLakes = await infrastructure.addChild("Subterranean lakes", 6, [alice]);

        // Hidden Passages contributions
        const alleysRoots = await infrastructure.addChild("Alleys & Roots", 9, [alice]);
        const trapDoors = await infrastructure.addChild("Trap-doors", 8, [clownsWithoutBorders]);
        const warpZones = await infrastructure.addChild("Warp zones", 7, [whalewatch]);

        // Alternative Venues contributions
        const driveIns = await infrastructure.addChild("Liberation Drive-ins", 8, [alice]);
        const trainYards = await infrastructure.addChild("Train-yards", 7, [whalewatch]);
        const fleaMarkets = await infrastructure.addChild("Flea Markets", 6, [alice]);
        const roofs = await infrastructure.addChild("Roofs", 5, [whalewatch]);
        const ufoLanding = await infrastructure.addChild("*ufo* Landing Pads", 5, [clownsWithoutBorders]);

        // Reality Manipulation contributions
        const cloudBusting = await magicalTech.addChild("Cloud Busting", 9, [alice]);
        const cameraAbatement = await magicalTech.addChild("Camera Abatement", 8, [whalewatch]);
        const systemOfframp = await magicalTech.addChild("System (off/out)-ramp Drive-thrus", 7, [alice]);

        // Mystical Operations contributions
        const bioSlimes = await magicalTech.addChild("Bioluminescent Slimes", 8, [alice]);
        const butterflyWings = await magicalTech.addChild("Butterfly-wing-iridescence Materiality", 8, [whalewatch]); 
        const eventHorizons = await magicalTech.addChild("Event Horizons & Vanishing Points", 7, [clownsWithoutBorders]);

        // Sacred Knowledge contributions
        const libraryStacks = await magicalTech.addChild("Library Stacks", 8, [alice]);
        const saunaLore = await magicalTech.addChild("Pagan Sauna Lore", 7, [whalewatch]);
        const ritualSpaces = await magicalTech.addChild("Ritual Spaces", 6, [alice]);
        const candyWisdom = await magicalTech.addChild("Candy Store Wisdom", 6, [whalewatch]);

        // Magical Materials contributions
        const pixieDust = await substances.addChild("Pixie Dust & Silly Powders", 9, [alice]);
        const oozeSlimes = await substances.addChild("Oozes & slimes", 8, [whalewatch]);
        const potionsBalms = await substances.addChild("Potions & Balms", 7, [alice]);

        // Alchemical Mixtures contributions
        const veganWaters = await substances.addChild("Vegan & Non-vegan Waters", 8, [alice]);
        const mistsSprays = await substances.addChild("Mists & Sprays", 7, [whalewatch]);
        const lozengesBonbons = await substances.addChild("Lozenges & Bonbons", 6, [alice]);

        // Special Effects contributions
        const pheromones = await substances.addChild("Pheromonal Inflection Points", 8, [alice, researcher]);
        const darkMatter = await substances.addChild("Dark Matter Manipulation", 7, [whalewatch, clownsWithoutBorders]);
        const globulation = await substances.addChild("Nebulatory Coagular Globulation", 6, [alice, educator]);

        // Reality Scripts contributions
        const trueFakes = await realityHacking.addChild("TrueFakes & FakeUntruths", 9, [alice, researcher]);
        const memeDrives = await realityHacking.addChild("MemeDrives & GeneEngines", 8, [whalewatch, clownsWithoutBorders]);
        const cosmicBabble = await realityHacking.addChild("Cosmic Psychobabble", 7, [alice, educator]);

        // Dimensional Engineering contributions
        const dimPortals = await realityHacking.addChild("Interdimensional portals", 8, [alice, researcher]);
        const infinityPools = await realityHacking.addChild("Infinity Pools", 7, [whalewatch, clownsWithoutBorders]);
        const deprivationTanks = await realityHacking.addChild("Sensory Deprivation Tankage", 6, [alice, educator]);

        // Mathematical Magic contributions
        const girlMath = await realityHacking.addChild("GirlMath", 8, [alice, researcher]);
        const moonMath = await realityHacking.addChild("Moonlight Mathematicians", 7, [whalewatch, clownsWithoutBorders]);
        const angelicNums = await realityHacking.addChild("Angelic Numbers", 6, [alice, educator]);

        // Narrative Crafting contributions
        const comicBooks = await loreSystem.addChild("Comic Books & Stories", 8, [alice, researcher]);
        const poemsAndMaps = await loreSystem.addChild("Poems & Maps", 7, [whalewatch, clownsWithoutBorders]);

        // Wisdom Keepers contributions
        const priestesses = await loreSystem.addChild("Interdimensional Priestesses", 8, [alice, researcher]);
        const crimeLords = await loreSystem.addChild("Alien Crime Lords", 7, [whalewatch, clownsWithoutBorders]);
        const ballerinas = await loreSystem.addChild("Sci-fi Ballerinas", 6, [alice, educator]);

        // whalewatch's recognition of app
        const whalewatchgive = await whalewatch.addChild('🌳 give', 80);
        const whalewatchrecieve = await whalewatch.addChild('recieve', 80);
        const whalewatchpotential = await whalewatchgive.addChild('🔮 potential', 40);
        const appInwhalewatchpotential = await whalewatchpotential.addChild(app.name, 15, [app]);

        // alice's recognition of app
        const alicegive = await alice.addChild('🌳 give', 80);
        const alicepotential = await alicegive.addChild('🔮 potential', 40);
        const appInalicepotential = await alicepotential.addChild(app.name, 15, [app]);

        // clownsWithoutBorders's recognition of app
        const clownsWithoutBordersgive = await clownsWithoutBorders.addChild('🌳 give', 80);
        const clownsWithoutBorderspotential = await clownsWithoutBordersgive.addChild('🔮 potential', 40);
        const appInclownsWithoutBorderspotential = await clownsWithoutBorderspotential.addChild(app.name, 15, [app]);


    // Return the root node and any other important references
    return {
        app,
        whalewatch,
        alice,
        clownsWithoutBorders,
        researcher,
        educator,
        environmentalist
    };
}