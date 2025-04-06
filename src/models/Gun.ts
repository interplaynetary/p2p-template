import Gun from 'gun/gun'
import SEA from 'gun/sea.js'

// import 'gun/lib/radix'
// import 'gun/lib/radisk'
// import 'gun/lib/store'
// import 'gun/lib/rindexed'
// import 'gun/lib/webrtc'

// Initialize Gun with peer and storage
export const gun = Gun({
  peers: ['http://127.0.0.1:5500/gun'],
  localStorage: true
});

// Get authenticated user space
export const user = gun.user();

// Recall user session - returns a promise for async/await support
export const recallUser = (): Promise<void> => {
  return new Promise((resolve) => {
    // Already authenticated? Resolve immediately
    if (user.is?.pub) {
      resolve();
      return;
    }

    // Set up one-time auth handler
    const authHandler = () => {
      (gun as any).off('auth', authHandler);
      resolve();
    };
    gun.on('auth', authHandler);

    // Attempt recall
    user.recall({ sessionStorage: true });

    // Safety timeout
    setTimeout(() => {
      (gun as any).off('auth', authHandler);
      resolve();
    }, 1000);
  });
};

// Single authentication function that handles both login and signup
export const authenticate = async (alias: string, pass: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Save the username to localStorage BEFORE authentication completes
    // This ensures we always have it available even in subsequent sessions
    localStorage.setItem('gundb-username', alias);
    
    // First try to login
    user.auth(alias, pass, (ack: any) => {
      if (!ack.err) {
        console.log('Login successful, username saved:', alias);
        resolve();
        return;
      }
      
      // If login fails, create and authenticate new user
      user.create(alias, pass, (createAck: any) => {
        if (createAck.err) {
          reject(new Error(createAck.err));
          return;
        }
        
        console.log('User created, username saved:', alias);
        
        // After creation, authenticate
        user.auth(alias, pass, (authAck: any) => {
          authAck.err ? reject(new Error(authAck.err)) : resolve();
        });
      });
    });
  });
};

// Clean logout that clears storage
export const logout = () => {
  user.leave();
  sessionStorage.clear();
  localStorage.clear();
};

// Helper to get encrypted user paths
export const getPath = async (path: string) => {
  if (!user.is) return null;
  const pair = (user as any)._.sea;  // Type assertion for internal Gun property
  const proof = await SEA.work(path, pair);
  return proof ? `~${user.is.pub}/${proof}` : null;
};

// Get user's nodes graph
export const getNodesGraph = async () => {
  const path = await getPath('nodes');
  return path ? user.get(path) : null;
};

/*
var SEA = Gun.SEA;
;(async () => {
var pair = await SEA.pair();
var enc = await SEA.encrypt('hello self', pair);
var data = await SEA.sign(enc, pair);
console.log(data);
var msg = await SEA.verify(data, pair.pub);
var dec = await SEA.decrypt(msg, pair);
var proof = await SEA.work(dec, pair);
var check = await SEA.work('hello self', pair);
console.log(dec);
console.log(proof === check);
// now let's share private data with someone:
var alice = await SEA.pair();
var bob = await SEA.pair();
var enc = await SEA.encrypt('shared data', await SEA.secret(bob.epub, alice));
await SEA.decrypt(enc, await SEA.secret(alice.epub, bob));
// `.secret` is Elliptic-curve Diffie–Hellman
// Bob allows Alice to write to part of his graph, he creates a certificate for Alice
var certificate = await SEA.certify(alice.pub, ["^AliceOnly.*"], bob)
// Alice logs in 
const gun = Gun();
await gun.user().auth(alice);
// and uses the certificate
await gun.get('~'+bob.pub).get('AliceOnly').get('do-not-tell-anyone').put(enc, null, {opt: {cert: certificate}})
await gun.get('~'+bob.pub).get('AliceOnly').get('do-not-tell-anyone').once(console.log) // return 'enc'
})();
*/