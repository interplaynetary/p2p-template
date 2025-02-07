/**
 * A minimal public interface that wraps around the internal App instance.
 * In a distributed system, this is the object you might expose via an RPC call,
 * so that remote peers only have access to the methods you explicitly share.
 */
export class PublicInterface {
    // lets make a proxy for the app class
    constructor(app) {
        this._app = app;
    }
    // the only information necessary for distributed calculations
    // allow for calling shareOfGeneralFulfillment(node) 
    shareOfGeneralFulfillment(callerNode) {
        return this._app.data.shareOfGeneralFulfillment(callerNode);
    }
    // allow for calling mutualFulfillment(node)
    mutualFulfillment(callerNode) {
        return this._app.data.mutualFulfillment(callerNode);
    }
}

// Lets add caching of the results of the methods

export class PublicInterfaceClient {
    constructor(rpcClient) {
        // rpcClient is whatever you use to send JSON-RPC calls
        this.rpcClient = rpcClient;
    }

    // This method matches the local PublicInterface method signature:
    async shareOfGeneralFulfillment(callerNode) {
        // Calls the remote method “shareOfGeneralFulfillment”
        // on the remote peer’s real PublicInterface
        return await this.rpcClient.call("shareOfGeneralFulfillment", [callerNode]);
    }

    // Same structure for mutualFulfillment:
    async mutualFulfillment(callerNode) {
        return await this.rpcClient.call("mutualFulfillment", [callerNode]);
    }
}