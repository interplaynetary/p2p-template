import { TreeNode } from './models/TreeNode';

// Export the initialization function
export async function initializeExampleData(root: TreeNode) {
  console.log("Checking for existing data before initialization...");
  
  /*
  // Initialize data structure - using new TreeNode implementation
  const environmentalist = TreeNode.create('environmentalist');
  const clownsWithoutBorders = TreeNode.create('clowns4all', { typeIds: [environmentalist.id] });
  const researcher = TreeNode.create('researcher', { typeIds: [environmentalist.id] });
  const educator = TreeNode.create('educator', { typeIds: [environmentalist.id] });

  // Our main nodes with multiple types
  const whalewatch = TreeNode.create('whalewatch', { typeIds: [researcher.id] });  // is a contributor
  const alice = TreeNode.create('alice', { typeIds: [researcher.id] });  // is a contributor
  */

  // Check if the major categories already exist
  const existingChildren = Array.from(root.children.values()).map(child => child.name);
  console.log(`Root has ${existingChildren.length} existing children: ${existingChildren.join(', ')}`);
  
  // Only create Space & Environment if it doesn't exist
  let space;
  if (!existingChildren.includes("Space & Environment")) {
    console.log("Creating Space & Environment node");
    space = await root.addChild("Space & Environment", 25);
  } else {
    console.log("Space & Environment already exists, using existing node");
    space = Array.from(root.children.values()).find(child => child.name === "Space & Environment");
  }
  
  // Only proceed with creating children if we have a valid space node
  if (space) {
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
    const subverse = await root.addChild("Subverse 🌌", 25);
	
    const magicalTech = await subverse.addChild("Magical Technologies & Systems", 25);
    const substances = await subverse.addChild("Transformative Substances", 20);
    const realityHacking = await subverse.addChild("Reality Hacking & Manifestation", 20);
    const loreSystem = await subverse.addChild("Lore & Knowledge Systems", 10);

    const money = await root.addChild("Money", 10)
    const freeAssociation = await root.addChild("Free Association", 10)

    const automation = await root.addChild("Automation of Useful-repetitive Tasks", 10)
    const commons = await root.addChild("Socialization of Land & Means of Production", 10)
    const property = await root.addChild("Maintaining Personal Property Relations", 10)
    
    const securingLaptop = await property.addChild("Securing my Laptop", 10)
    const securingBackpack = await property.addChild("Securing my Backpack", 10)

    const openCollective = await money.addChild("Playnet Open Collective", 10)
    const personalDonations = await money.addChild("Personal Donations", 10)

    const development = await freeAssociation.addChild("Development", 10)
    const communications = await freeAssociation.addChild("Communications", 10)

    // Now using IDs instead of objects for addType
    communications.addType(money.id);
    communications.addType(development.id);

    /*
    // Underground Networks contributions
    const secretStairs = await infrastructure.addChild("Secret stairways", 10, [alice.id]);
    const wellsTunnels = await infrastructure.addChild("Wells & tunnels", 8, [clownsWithoutBorders.id]);
    const basements = await infrastructure.addChild("Basements", 7, [alice.id]);
    const subLakes = await infrastructure.addChild("Subterranean lakes", 6, [alice.id]);

    // Hidden Passages contributions
    const alleysRoots = await infrastructure.addChild("Alleys & Roots", 9, [alice.id]);
    const trapDoors = await infrastructure.addChild("Trap-doors", 8, [clownsWithoutBorders.id]);
    const warpZones = await infrastructure.addChild("Warp zones", 7, [whalewatch.id]);

    // Alternative Venues contributions
    const driveIns = await infrastructure.addChild("Liberation Drive-ins", 8, [alice.id]);
    const trainYards = await infrastructure.addChild("Train-yards", 7, [whalewatch.id]);
    const fleaMarkets = await infrastructure.addChild("Flea Markets", 6, [alice.id]);
    const roofs = await infrastructure.addChild("Roofs", 5, [whalewatch.id]);
    const ufoLanding = await infrastructure.addChild("*ufo* Landing Pads", 5, [clownsWithoutBorders.id]);

    // Reality Manipulation contributions
    const cloudBusting = await magicalTech.addChild("Cloud Busting", 9, [alice.id]);
    const cameraAbatement = await magicalTech.addChild("Camera Abatement", 8, [whalewatch.id]);
    const systemOfframp = await magicalTech.addChild("System (off/out)-ramp Drive-thrus", 7, [alice.id]);

    // Mystical Operations contributions
    const bioSlimes = await magicalTech.addChild("Bioluminescent Slimes", 8, [alice.id]);
    const butterflyWings = await magicalTech.addChild("Butterfly-wing-iridescence Materiality", 8, [whalewatch.id]); 
    const eventHorizons = await magicalTech.addChild("Event Horizons & Vanishing Points", 7, [clownsWithoutBorders.id]);

    // Sacred Knowledge contributions
    const libraryStacks = await magicalTech.addChild("Library Stacks", 8, [alice.id]);
    const saunaLore = await magicalTech.addChild("Pagan Sauna Lore", 7, [whalewatch.id]);
    const ritualSpaces = await magicalTech.addChild("Ritual Spaces", 6, [alice.id]);
    const candyWisdom = await magicalTech.addChild("Candy Store Wisdom", 6, [whalewatch.id]);

    // Magical Materials contributions
    const pixieDust = await substances.addChild("Pixie Dust & Silly Powders", 9, [alice.id]);
    const oozeSlimes = await substances.addChild("Oozes & slimes", 8, [whalewatch.id]);
    const potionsBalms = await substances.addChild("Potions & Balms", 7, [alice.id]);

    // Alchemical Mixtures contributions
    const veganWaters = await substances.addChild("Vegan & Non-vegan Waters", 8, [alice.id]);
    const mistsSprays = await substances.addChild("Mists & Sprays", 7, [whalewatch.id]);
    const lozengesBonbons = await substances.addChild("Lozenges & Bonbons", 6, [alice.id]);

    // Special Effects contributions
    const pheromones = await substances.addChild("Pheromonal Inflection Points", 8, [alice.id, researcher.id]);
    const darkMatter = await substances.addChild("Dark Matter Manipulation", 7, [whalewatch.id, clownsWithoutBorders.id]);
    const globulation = await substances.addChild("Nebulatory Coagular Globulation", 6, [alice.id, educator.id]);

    // Reality Scripts contributions
    const trueFakes = await realityHacking.addChild("TrueFakes & FakeUntruths", 9, [alice.id, researcher.id]);
    const memeDrives = await realityHacking.addChild("MemeDrives & GeneEngines", 8, [whalewatch.id, clownsWithoutBorders.id]);
    const cosmicBabble = await realityHacking.addChild("Cosmic Psychobabble", 7, [alice.id, educator.id]);

    // Dimensional Engineering contributions
    const dimPortals = await realityHacking.addChild("Interdimensional portals", 8, [alice.id, researcher.id]);
    const infinityPools = await realityHacking.addChild("Infinity Pools", 7, [whalewatch.id, clownsWithoutBorders.id]);
    const deprivationTanks = await realityHacking.addChild("Sensory Deprivation Tankage", 6, [alice.id, educator.id]);

    // Mathematical Magic contributions
    const girlMath = await realityHacking.addChild("GirlMath", 8, [alice.id, researcher.id]);
    const moonMath = await realityHacking.addChild("Moonlight Mathematicians", 7, [whalewatch.id, clownsWithoutBorders.id]);
    const angelicNums = await realityHacking.addChild("Angelic Numbers", 6, [alice.id, educator.id]);

    // Narrative Crafting contributions
    const comicBooks = await loreSystem.addChild("Comic Books & Stories", 8, [alice.id, researcher.id]);
    const poemsAndMaps = await loreSystem.addChild("Poems & Maps", 7, [whalewatch.id, clownsWithoutBorders.id]);

    // Wisdom Keepers contributions
    const priestesses = await loreSystem.addChild("Interdimensional Priestesses", 8, [alice.id, researcher.id]);
    const crimeLords = await loreSystem.addChild("Alien Crime Lords", 7, [whalewatch.id, clownsWithoutBorders.id]);
    const ballerinas = await loreSystem.addChild("Sci-fi Ballerinas", 6, [alice.id, educator.id]);
    */
    /*
    // whalewatch's recognition of app
    const whalewatchgive = await whalewatch.addChild('🌳 give', 80);
    const whalewatchrecieve = await whalewatch.addChild('recieve', 80);
    const whalewatchpotential = await whalewatchgive.addChild('🔮 potential', 40);
    const appInwhalewatchpotential = await whalewatchpotential.addChild(root.name, 15, [root.id]);

    // alice's recognition of app
    const alicegive = await alice.addChild('🌳 give', 80);
    const alicepotential = await alicegive.addChild('🔮 potential', 40);
    const appInalicepotential = await alicepotential.addChild(root.name, 15, [root.id]);

    // clownsWithoutBorders's recognition of app
    const clownsWithoutBordersgive = await clownsWithoutBorders.addChild('🌳 give', 80);
    const clownsWithoutBorderspotential = await clownsWithoutBordersgive.addChild('🔮 potential', 40);
    const appInclownsWithoutBorderspotential = await clownsWithoutBorderspotential.addChild(root.name, 15, [root.id]);
    */
  }

  // Return the root node and any other important references
  return { root };
}