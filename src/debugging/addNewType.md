// why are we ever saving with nodes/
// lets not do that!

TreeNode.ts:615 [TreeNode] Child m8orkhinBtBRd0t3Rgpp (Personal Donations) loaded successfully for m8orkgprmDZHqulDrLFM
TreeNode.ts:725 [TreeNode] Node nodes/qRkAbYD0sG7CN6HD2S6tjdxDiSfSjJJqLyW4fJa3Oso.KmcsNIfFBO-mfAB5jOMnTUO1psir5OuyA8FWHG3ut38 not found in Gun (data is falsy)
TreeNode.ts:664 [TreeNode] Failed to load type with ID nodes/qRkAbYD0sG7CN6HD2S6tjdxDiSfSjJJqLyW4fJa3Oso.
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: nodes/qRkAbYD0sG7CN6HD2S6tjdxDiSfSjJJqLyW4fJa3Oso.KmcsNIfFBO-mfAB5jOMnTUO1psir5OuyA8FWHG3ut38
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: nodes/qRkAbYD0sG7CN6HD2S6tjdxDiSfSjJJqLyW4fJa3Oso.KmcsNIfFBO-mfAB5jOMnTUO1psir5OuyA8FWHG3ut38
TreeNode.ts:725 [TreeNode] Node nodes/qRkAbYD0sG7CN6HD2S6tjdxDiSfSjJJqLyW4fJa3Oso.KmcsNIfFBO-mfAB5jOMnTUO1psir5OuyA8FWHG3ut38 not found in Gun (data is falsy)


In line 701 we should be using the userKey and NOT the userData in order to perform lookups

{_: {…}, lastSeen: 1742923337302, manualFulfillment: null, name: 'love', points: 0}lastSeen: 1742923337302manualFulfillment: nullname: "love"points: 0_: {>: {…}, #: 'users/qRkAbYD0sG7CN6HD2S6tjdxDiSfSjJJqLyW4fJa3Oso.KmcsNIfFBO-mfAB5jOMnTUO1psir5OuyA8FWHG3ut38'}[[Prototype]]: Object qRkAbYD0sG7CN6HD2S6tjdxDiSfSjJJqLyW4fJa3Oso.KmcsNIfFBO-mfAB5jOMnTUO1psir5OuyA8FWHG3ut38

// somehow between persists we seem to be saving the id by trying to extract it using _

I dont understand how we ever arive at appending nodes/ in the first place? Or is it simple that gun just has it like that.

INTERESTING INFO could potentially reveal something






// Other notes:
// we get a lot of node not found in user path, could it be that when we are trying to construct the tree of an OTHER we keep looking up the user which is ourself?
