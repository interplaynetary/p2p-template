// Initialize Gun with SEA
const SEA = Gun.SEA;
console.log('Initializing Gun with peer:', ['http://127.0.0.1:5500/gun']);
const gun = Gun(['http://127.0.0.1:5500/gun']);

// Get authenticated user space
export const user = gun.user();
console.log('Initial user state:', user.is);

// Authentication helpers with proper error handling
export const login = async (alias, pass) => {
  console.log('\n=== Attempting login ===');
  console.log('Username:', alias);
  
  return new Promise((resolve, reject) => {
    user.auth(alias, pass, async (ack) => {
      if(ack.err) {
        console.error('Login failed:', ack.err);
        reject(new Error(ack.err));
        return;
      }
      
      console.log('Login successful:', ack);
      console.log('User pair:', user._.sea);
      
      try {
        // Clean up old data first
        await cleanup();
        
        // Initialize user space
        await initializeUserSpace();
        
        resolve(ack);
      } catch (err) {
        console.error('Error during login setup:', err);
        reject(err);
      }
    });
  });
};

export const create = async (alias, pass) => {
  console.log('Creating new user:', alias);
  return new Promise((resolve, reject) => {
    user.create(alias, pass, async (ack) => {
      if(ack.err) {
        console.error('User creation failed:', ack.err);
        reject(new Error(ack.err));
      } else {
        console.log('User created successfully:', ack);
        await login(alias, pass); // This will also create the root node
        resolve(ack);
      }
    });
  });
};

export const logout = () => {
  console.log('Logging out user:', user.is?.pub);
  user.leave();
  console.log('User logged out. Current user state:', user.is);
};

// Helper to check if user is authenticated
export const isAuthenticated = () => {
  return user.is;
};

export const cleanup = async () => {
  if (!user.is) return;
  await Promise.all([
      new Promise(r => user.get('nodes').put(null, r)),
      new Promise(r => user.get('types').put(null, r))
  ]);
};

// Helper to get encrypted paths
export const getPath = async (path) => {
  if (!user.is) {
    // console.error('getPath: No authenticated user');
    return null;
  }
  // console.log('Getting encrypted path for:', path);
  const proof = await SEA.work(path, user.pair());
  const encryptedPath = `~${user.is.pub}/${proof}`;
  // console.log('Generated encrypted path:', encryptedPath);
  return encryptedPath;
};

// Root nodes for our data structure - in user's encrypted space
export const getNodesGraph = async () => {
  const path = await getPath('nodes');
  // console.log('Getting nodes graph at path:', path);
  if (!path) {
    // console.error('No path returned from getPath');
    return null;
  }
  return user.get(path);  // Return the Gun chain directly
};

export const getTypesGraph = async () => {
  const path = await getPath('types');
  // console.log('Getting types graph at path:', path);
  return path ? user.get(path) : null;
};

export const initializeUserSpace = async () => {
    console.log('Initializing user space...');
    
    // Create root node data with Gun-friendly objects
    const rootData = {
        id: user.is.pub,
        name: user.is.alias,
        parentId: null,
        childrenIds: {},  // Empty object instead of array
        typeIds: {},      // Empty object instead of array
        points: 0,
        totalChildPoints: 0,
        isContributor: true,
        _manualFulfillment: null
    };

    // Initialize both graphs
    user.get('nodes').get(user.is.pub).put(rootData);
    user.get('types').put({});
    
    return rootData;
};

// Add database inspection helper
export const inspectDatabase = () => {
    return new Promise((resolve) => {
        user.get('nodes').once((nodes) => {
            console.log('Current Gun Database State:', {
                nodes,
                user: user.is
            });
            resolve(nodes);
        });
    });
};

// Usage example:
export const debugSave = async (nodeId, data) => {
    console.log('Before save:');
    await inspectDatabase();
    
    await user.get('nodes').get(nodeId).put(data);
    
    console.log('After save:');
    await inspectDatabase();
};