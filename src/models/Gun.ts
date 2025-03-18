import Gun from 'gun/gun'
import SEA from 'gun/sea.js'
// import 'gun/lib/radix'
// import 'gun/lib/radisk'
// import 'gun/lib/store'
// import 'gun/lib/rindexed'
// import 'gun/lib/webrtc'

// Initialize Gun with SEA
console.log('Initializing Gun with peer:', ['http://127.0.0.1:5500/gun']);

export let gun = Gun({
  peers: ['http://127.0.0.1:5500/gun'],
  localStorage: true
})

// Get authenticated user space
export const user = gun.user();
// user.recall({sessionStorage: true}) // Stay logged in across sessions

// Single authentication function that handles both login and signup
export const authenticate = async (alias: string, pass: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // First try to login
    user.auth(alias, pass, (ack: any) => {
      if (!ack.err) {
        console.log('Auth successful')
        resolve()
        return
      }
      
      // If login fails, try to create account
      user.create(alias, pass, (createAck: any) => {
        if (createAck.err) {
          reject(new Error(createAck.err))
          return
        }
        console.log('Auth successful')
        resolve()
      })
    })
  })
}

export const logout = () => {
  user.leave()
}

// Helper to get encrypted paths
export const getPath = async (path: string) => {
  if (!user.is) return null
  const pair = (user as any)._.sea
  const proof = await SEA.work(path, pair)
  return proof ? `~${user.is.pub}/${proof}` : null
}

// Root nodes for our data structure - in user's encrypted space
export const getNodesGraph = async () => {
  const path = await getPath('nodes')
  return path ? user.get(path) : null
}