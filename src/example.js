// Import D3Node if you're using modules
import { D3Node } from './models/D3Node.js';

// Export the initialization function
export function initializeExampleData() {

        // Initialize data structure
        const environmentalist = new D3Node('environmentalist');
        const clownsWithoutBorders = new D3Node('clowns4all', null, [environmentalist]);
        const researcher = new D3Node('researcher', null, [environmentalist]);
        const educator = new D3Node('educator', null, [environmentalist]);

        // Our main nodes with multiple types
        const whalewatch = new D3Node('whalewatch', null, [researcher]);  // is a contributor
        const alice = new D3Node('alice', null, [researcher]);  // is a contributor

        const ruzgar = new D3Node('ruzgar');

        // 1. Material Needs & Dependencies
        const space = ruzgar.addChild("Space & Environment", 25);

        // Space & Environment children
        const indoorSpace = space.addChild("Indoor/Outdoor Space", 15);
        const seating = space.addChild("Comfortable Seating", 15);
        const lighting = space.addChild("Lighting", 12);
        const temperature = space.addChild("Temperature Control", 12);
        const bathroom = space.addChild("Bathroom Access", 12);
        const waterAccess = space.addChild("Water Access", 12);
        const cleaning = space.addChild("Cleaning Supplies", 11);
        const waste = space.addChild("Trash/Recycling", 11);

        console.log(ruzgar);
        
        const hosts = indoorSpace.addChild("Space Providers/Hosts", 14);
        const infrastructure = indoorSpace.addChild("Infra(de)structure & Bottom-secret Spaces", 25);

        // Main Categories with their percentage weights
        const subverse = ruzgar.addChild("Subverse 🌌", 25);

        const magicalTech = subverse.addChild("Magical Technologies & Systems", 25);
        const substances = subverse.addChild("Transformative Substances", 20);
        const realityHacking = subverse.addChild("Reality Hacking & Manifestation", 20);
        const loreSystem = subverse.addChild("Lore & Knowledge Systems", 10);

        const money = ruzgar.addChild("Money", 10)
        const freeAssociation = ruzgar.addChild("Free Association", 10)

        const automation = ruzgar.addChild("Automation of Useful-repetitive Tasks", 10)
        const commons = ruzgar.addChild("Socialization of Land & Means of Production", 10)
        const property = ruzgar.addChild("Maintaining Personal Property Relations", 10)
        const securingLaptop = property.addChild("Securing my Laptop", 10)
        const securingBackpack = property.addChild("Securing my Backpack", 10)

        const openCollective = money.addChild("Playnet Open Collective", 10)
        const personalDonations = money.addChild("Personal Donations", 10)

        const development = freeAssociation.addChild("Development", 10)
        const communications = freeAssociation.addChild("Communications", 10)

        // Underground Networks contributions
        const secretStairs = infrastructure.addChild("Secret stairways", 10, [alice]);
        const wellsTunnels = infrastructure.addChild("Wells & tunnels", 8, [clownsWithoutBorders]);
        const basements = infrastructure.addChild("Basements", 7, [alice]);
        const subLakes = infrastructure.addChild("Subterranean lakes", 6, [alice]);

        // Hidden Passages contributions
        const alleysRoots = infrastructure.addChild("Alleys & Roots", 9, [alice]);
        const trapDoors = infrastructure.addChild("Trap-doors", 8, [clownsWithoutBorders]);
        const warpZones = infrastructure.addChild("Warp zones", 7, [whalewatch]);

        // Alternative Venues contributions
        const driveIns = infrastructure.addChild("Liberation Drive-ins", 8, [alice]);
        const trainYards = infrastructure.addChild("Train-yards", 7, [whalewatch]);
        const fleaMarkets = infrastructure.addChild("Flea Markets", 6, [alice]);
        const roofs = infrastructure.addChild("Roofs", 5, [whalewatch]);
        const ufoLanding = infrastructure.addChild("*ufo* Landing Pads", 5, [clownsWithoutBorders]);

        // Reality Manipulation contributions
        const cloudBusting = magicalTech.addChild("Cloud Busting", 9, [alice]);
        const cameraAbatement = magicalTech.addChild("Camera Abatement", 8, [whalewatch]);
        const systemOfframp = magicalTech.addChild("System (off/out)-ramp Drive-thrus", 7, [alice]);

        // Mystical Operations contributions
        const bioSlimes = magicalTech.addChild("Bioluminescent Slimes", 8, [alice]);
        const butterflyWings = magicalTech.addChild("Butterfly-wing-iridescence Materiality", 8, [whalewatch]); 
        const eventHorizons = magicalTech.addChild("Event Horizons & Vanishing Points", 7, [clownsWithoutBorders]);

        // Sacred Knowledge contributions
        const libraryStacks = magicalTech.addChild("Library Stacks", 8, [alice]);
        const saunaLore = magicalTech.addChild("Pagan Sauna Lore", 7, [whalewatch]);
        const ritualSpaces = magicalTech.addChild("Ritual Spaces", 6, [alice]);
        const candyWisdom = magicalTech.addChild("Candy Store Wisdom", 6, [whalewatch]);

        // Magical Materials contributions
        const pixieDust = substances.addChild("Pixie Dust & Silly Powders", 9, [alice]);
        const oozeSlimes = substances.addChild("Oozes & slimes", 8, [whalewatch]);
        const potionsBalms = substances.addChild("Potions & Balms", 7, [alice]);

        // Alchemical Mixtures contributions
        const veganWaters = substances.addChild("Vegan & Non-vegan Waters", 8, [alice]);
        const mistsSprays = substances.addChild("Mists & Sprays", 7, [whalewatch]);
        const lozengesBonbons = substances.addChild("Lozenges & Bonbons", 6, [alice]);

        // Special Effects contributions
        const pheromones = substances.addChild("Pheromonal Inflection Points", 8, [alice, researcher]);
        const darkMatter = substances.addChild("Dark Matter Manipulation", 7, [whalewatch, clownsWithoutBorders]);
        const globulation = substances.addChild("Nebulatory Coagular Globulation", 6, [alice, educator]);

        // Reality Scripts contributions
        const trueFakes = realityHacking.addChild("TrueFakes & FakeUntruths", 9, [alice, researcher]);
        const memeDrives = realityHacking.addChild("MemeDrives & GeneEngines", 8, [whalewatch, clownsWithoutBorders]);
        const cosmicBabble = realityHacking.addChild("Cosmic Psychobabble", 7, [alice, educator]);

        // Dimensional Engineering contributions
        const dimPortals = realityHacking.addChild("Interdimensional portals", 8, [alice, researcher]);
        const infinityPools = realityHacking.addChild("Infinity Pools", 7, [whalewatch, clownsWithoutBorders]);
        const deprivationTanks = realityHacking.addChild("Sensory Deprivation Tankage", 6, [alice, educator]);

        // Mathematical Magic contributions
        const girlMath = realityHacking.addChild("GirlMath", 8, [alice, researcher]);
        const moonMath = realityHacking.addChild("Moonlight Mathematicians", 7, [whalewatch, clownsWithoutBorders]);
        const angelicNums = realityHacking.addChild("Angelic Numbers", 6, [alice, educator]);

        // Narrative Crafting contributions
        const comicBooks = loreSystem.addChild("Comic Books & Stories", 8, [alice, researcher]);
        const poemsAndMaps = loreSystem.addChild("Poems & Maps", 7, [whalewatch, clownsWithoutBorders]);

        // Wisdom Keepers contributions
        const priestesses = loreSystem.addChild("Interdimensional Priestesses", 8, [alice, researcher]);
        const crimeLords = loreSystem.addChild("Alien Crime Lords", 7, [whalewatch, clownsWithoutBorders]);
        const ballerinas = loreSystem.addChild("Sci-fi Ballerinas", 6, [alice, educator]);

        // whalewatch's recognition of ruzgar
        const whalewatchgive = whalewatch.addChild('🌳 give', 80);
        const whalewatchrecieve = whalewatch.addChild('recieve', 80);
        const whalewatchpotential = whalewatchgive.addChild('🔮 potential', 40);
        const ruzgarInwhalewatchpotential = whalewatchpotential.addChild('ruzgar', 15, [ruzgar]);

        // alice's recognition of ruzgar
        const alicegive = alice.addChild('🌳 give', 80);
        const alicepotential = alicegive.addChild('🔮 potential', 40);
        const ruzgarInalicepotential = alicepotential.addChild('ruzgar', 15, [ruzgar]);

        // clownsWithoutBorders's recognition of ruzgar
        const clownsWithoutBordersgive = clownsWithoutBorders.addChild('🌳 give', 80);
        const clownsWithoutBorderspotential = clownsWithoutBordersgive.addChild('🔮 potential', 40);
        const ruzgarInclownsWithoutBorderspotential = clownsWithoutBorderspotential.addChild('ruzgar', 15, [ruzgar]);


    // Return the root node and any other important references
    return {
        ruzgar,
        whalewatch,
        alice,
        clownsWithoutBorders,
        researcher,
        educator,
        environmentalist
    };
}
