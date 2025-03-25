import qualified Data.Map.Strict as Map
import qualified Data.Set as Set
import Data.Maybe (fromMaybe, isJust, maybeToList, mapMaybe, listToMaybe)
import Control.Monad (foldM)
import Data.Foldable (foldl', foldr')
import Data.Function (on, (&))
import Control.Arrow ((***), (&&&), first, second)

-- Improved type definitions with newtypes for better type safety
newtype RecognitionPoints = RecognitionPoints Int deriving (Eq, Ord, Show)

-- Unwrap RecognitionPoints to get the Int value
getPoints :: RecognitionPoints -> Int
getPoints (RecognitionPoints p) = p

-- Create RecognitionPoints
points :: Int -> RecognitionPoints
points = RecognitionPoints

-- Tree structure for hierarchical recognition model
data Node = Node {
    nodeId :: String,
    nodeName :: String,
    nodePoints :: RecognitionPoints,
    nodeParent :: Maybe Node,
    nodeChildren :: Map.Map String Node,
    nodeTypes :: Set.Set String,  -- Types are referenced by their ID
    nodeManualFulfillment :: Maybe Float
} deriving (Show, Eq, Ord)

-- Type alias for TypeIndex to track instances of each type
type TypeIndex = Map.Map String (Set.Set Node)

-- Create a new tree node with validation for manual fulfillment
createNode :: String -> String -> RecognitionPoints -> Maybe Node -> [String] -> Maybe Float -> Node
createNode id name points parent types manualFulfillment = 
    Node {
        nodeId = id,
        nodeName = name,
        nodePoints = points,
        nodeParent = parent,
        nodeChildren = Map.empty,
        nodeTypes = Set.fromList types,
        nodeManualFulfillment = validateManualFulfillment manualFulfillment
    }
  where
    -- Ensure manual fulfillment is between 0.0 and 1.0
    validateManualFulfillment Nothing = Nothing
    validateManualFulfillment (Just val)
        | val < 0.0 = Just 0.0
        | val > 1.0 = Just 1.0
        | otherwise = Just val

-- Check if a node is a contributor (root node)
isContributor :: Node -> Bool
isContributor = isNothing . nodeParent
  where
    isNothing = null . maybeToList

-- === Standardized Tree Operations ===

-- Apply a function to each node in the tree
mapTree :: (Node -> Node) -> Node -> Node
mapTree f node = 
    let updatedNode = f node
        updatedChildren = Map.map (mapTree f) (nodeChildren updatedNode)
    in updatedNode { nodeChildren = updatedChildren }

-- Fold a tree from the bottom up
foldTree :: (Node -> b -> b) -> b -> Node -> b
foldTree f initial node =
    -- Start with the accumulated value
    let accumulator = initial
        -- Apply the fold to each child node, starting with our initial value
        childrenFold = foldr (\child acc -> foldTree f acc child) accumulator (Map.elems (nodeChildren node))
    -- Finally, apply f to this node and the accumulated result from children
    in f node childrenFold

-- Filter children of a node
filterNodeChildren :: (Node -> Bool) -> Node -> [Node]
filterNodeChildren pred = filter pred . Map.elems . nodeChildren

-- Test if any child satisfies a predicate
anyNodeChild :: (Node -> Bool) -> Node -> Bool
anyNodeChild pred = any pred . Map.elems . nodeChildren

-- Sum a value over the children of a node
sumOverChildren :: (Node -> Float) -> Node -> Float
sumOverChildren f = sum . map f . Map.elems . nodeChildren

-- === End of Standardized Tree Operations ===

-- Safely get instances of a type from TypeIndex
getInstances :: TypeIndex -> String -> Set.Set Node
getInstances typeIndex typeId = Map.findWithDefault Set.empty typeId typeIndex


-- Safely get a type node from a type ID, returns Maybe to handle empty sets
getTypeNode :: TypeIndex -> String -> Maybe Node
getTypeNode typeIndex typeId = 
    let instances = getInstances typeIndex typeId
    in listToMaybe (Set.toList instances)

-- Check if a node is a contribution (has contributor types and a parent)
isContribution :: TypeIndex -> Node -> Bool
isContribution typeIndex tree = not (Set.null $ nodeTypes tree)
                             && hasContributorType
                             && isJust (nodeParent tree)
  where
    hasContributorType = any (hasContributor . getInstances typeIndex) 
                        (Set.toList $ nodeTypes tree)
    hasContributor = any isContributor . Set.toList

-- Add a node to the type index
addNodeToTypeIndex :: Node -> String -> TypeIndex -> TypeIndex
addNodeToTypeIndex node typeId typeIndex = 
    Map.alter (Just . Set.insert node . fromMaybe Set.empty) typeId typeIndex

-- Remove a node from a specific type in the index
removeNodeFromType :: Node -> String -> TypeIndex -> TypeIndex
removeNodeFromType node typeId typeIndex = 
    Map.adjust (Set.delete node) typeId typeIndex

-- Add a child to a tree node
addChild :: TypeIndex -> Node -> String -> String -> RecognitionPoints -> [String] -> Maybe Float -> Either String (Node, TypeIndex)
addChild typeIndex parent childId childName childPoints childTypes childManualFulfillment
    | isJust (nodeParent parent) && isContribution typeIndex parent =
        Left $ "Node " ++ nodeName parent ++ " is an instance of a contributor/contribution and cannot have children."
    | otherwise = Right (updatedParent, updatedTypeIndex)
  where
    -- Validate manual fulfillment before creating the child
    validatedManualFulfillment = case childManualFulfillment of
        Just val | val < 0.0 -> Just 0.0
                | val > 1.0 -> Just 1.0
                | otherwise -> Just val
        Nothing -> Nothing
        
    child = createNode childId childName childPoints (Just parent) childTypes validatedManualFulfillment
    updatedParent = parent { nodeChildren = Map.insert childId child (nodeChildren parent) }
    updatedTypeIndex = foldr' (\typeId idx -> addNodeToTypeIndex child typeId idx) typeIndex childTypes

-- Remove a child from a tree node
removeChild :: TypeIndex -> Node -> String -> (Node, TypeIndex)
removeChild typeIndex parent childId = case Map.lookup childId (nodeChildren parent) of
    Nothing -> (parent, typeIndex)
    Just child -> 
        let updatedParent = parent { nodeChildren = Map.delete childId (nodeChildren parent) }
            updatedTypeIndex = foldr' (\typeId idx -> removeNodeFromType child typeId idx) typeIndex (Set.toList $ nodeTypes child)
        in (updatedParent, updatedTypeIndex)

-- Add a type to a node
addType :: TypeIndex -> Node -> String -> (Node, TypeIndex)
addType typeIndex node typeId
    | Set.member typeId (nodeTypes node) = (node, typeIndex)
    | otherwise = 
        let updatedNode = node { nodeTypes = Set.insert typeId (nodeTypes node) }
            updatedTypeIndex = addNodeToTypeIndex node typeId typeIndex
        in (updatedNode, updatedTypeIndex)

-- Remove a type from a node
removeType :: TypeIndex -> Node -> String -> (Node, TypeIndex)
removeType typeIndex node typeId
    | not (Set.member typeId (nodeTypes node)) = (node, typeIndex)
    | otherwise = 
        let updatedNode = node { nodeTypes = Set.delete typeId (nodeTypes node) }
            updatedTypeIndex = removeNodeFromType node typeId typeIndex
        in (updatedNode, updatedTypeIndex)

-- Get a node's total child points
totalChildPoints :: Node -> Int
totalChildPoints = sum . map (getPoints . nodePoints) . Map.elems . nodeChildren

-- Calculate a node's weight (proportional importance in the tree)
weight :: Node -> Float
weight node = case nodeParent node of
    Nothing -> 1.0  -- Root node has weight 1.0
    Just parent -> 
        let parentTotalPoints = totalChildPoints parent
            nodePointsVal = getPoints (nodePoints node)
        in if parentTotalPoints == 0
           then 0.0
           else (fromIntegral nodePointsVal / fromIntegral parentTotalPoints) * weight parent

-- Calculate a node's share of its parent's total points
shareOfParent :: Node -> Float
shareOfParent node = case nodeParent node of
    Nothing -> 1.0  -- Root node has 100% share
    Just parent ->
        let parentTotalPoints = totalChildPoints parent
            nodePointsVal = getPoints (nodePoints node)
        in if parentTotalPoints == 0
           then 0.0
           else fromIntegral nodePointsVal / fromIntegral parentTotalPoints

-- Check if a node has direct contribution children
hasDirectContributionChild :: TypeIndex -> Node -> Bool
hasDirectContributionChild typeIndex = 
    anyNodeChild (isContribution typeIndex)

-- Check if a node has non-contribution children
hasNonContributionChild :: TypeIndex -> Node -> Bool
hasNonContributionChild typeIndex = 
    anyNodeChild (not . isContribution typeIndex)

-- Calculate the proportion of total child points from contribution children
contributionChildrenWeight :: TypeIndex -> Node -> Float
contributionChildrenWeight typeIndex node = ratio contributionPoints totalPoints
  where
    contributionPoints = sum $ map (getPoints . nodePoints) $ 
                         filterNodeChildren (isContribution typeIndex) node
    totalPoints = totalChildPoints node
    ratio _ 0 = 0.0
    ratio a b = fromIntegral a / fromIntegral b

-- Sum fulfillment from children matching a predicate
childrenFulfillment :: TypeIndex -> (Node -> Bool) -> Node -> Float
childrenFulfillment typeIndex pred node =
    sum $ map (\child -> fulfilled typeIndex child * shareOfParent child) $
          filterNodeChildren pred node

-- Calculate the fulfillment from contribution children
contributionChildrenFulfillment :: TypeIndex -> Node -> Float
contributionChildrenFulfillment typeIndex = 
    childrenFulfillment typeIndex (isContribution typeIndex)

-- Calculate the fulfillment from non-contribution children
nonContributionChildrenFulfillment :: TypeIndex -> Node -> Float
nonContributionChildrenFulfillment typeIndex =
    childrenFulfillment typeIndex (not . isContribution typeIndex)

-- Calculate the fulfillment of a node (core recursive function)
fulfilled :: TypeIndex -> Node -> Float
fulfilled typeIndex node
    -- Leaf nodes
    | Map.null (nodeChildren node) = 
        if isContribution typeIndex node then 1.0 else 0.0
    
    -- Nodes with manual fulfillment and contributor children
    | isJust (nodeManualFulfillment node) && hasDirectContributionChild typeIndex node = 
        let manualFulfillment = min 1.0 $ max 0.0 $ fromMaybe 0.0 (nodeManualFulfillment node)
        in if not (hasNonContributionChild typeIndex node)
           then manualFulfillment
           else 
               let contribWeight = contributionChildrenWeight typeIndex node
                   nonContribFulfillment = nonContributionChildrenFulfillment typeIndex node
               in manualFulfillment * contribWeight + nonContribFulfillment * (1.0 - contribWeight)
    
    -- Default case: weighted sum of all children's fulfillment
    | otherwise = 
        sumOverChildren (\child -> fulfilled typeIndex child * shareOfParent child) node

-- Calculate the desire (unfulfilled need) of a node
desire :: TypeIndex -> Node -> Float
desire typeIndex = (1.0 -) . fulfilled typeIndex

-- Calculate a node's share of general fulfillment from another type
shareOfGeneralFulfillment :: TypeIndex -> Node -> Node -> Float
shareOfGeneralFulfillment typeIndex node typeNode =
    getInstances typeIndex (nodeId typeNode)
    & Set.filter (\instance_ -> node == instance_ || any ((==) node) (ancestors instance_))
    & Set.toList
    & map calculateInstanceShare
    & sum
  where
    calculateInstanceShare instance_ = 
        let contributorTypes = Set.filter (hasContributor typeIndex) (nodeTypes instance_)
            contributorTypesCount = Set.size contributorTypes
            fWeight = fulfilled typeIndex instance_ * weight instance_
        in if contributorTypesCount > 0
           then fWeight / fromIntegral contributorTypesCount
           else fWeight
    hasContributor idx = any isContributor . Set.toList . getInstances idx
    ancestors n = case nodeParent n of
            Nothing -> []
                    Just p -> p : ancestors p

-- Calculate mutual fulfillment between two nodes
mutualFulfillment :: TypeIndex -> Node -> Node -> Float
mutualFulfillment typeIndex node1 node2 =
    min (shareOfGeneralFulfillment typeIndex node1 node2)
        (shareOfGeneralFulfillment typeIndex node2 node1)

-- Calculate mutual fulfillment distribution
mutualFulfillmentDistribution :: TypeIndex -> Node -> Map.Map Node Float
mutualFulfillmentDistribution typeIndex node =
    let validTypeIds = filter (not . Set.null . getInstances typeIndex) 
                             (Map.keys typeIndex)
        
        getMutualFulfillment typeId = do
            typeNode <- getTypeNode typeIndex typeId
            let mf = mutualFulfillment typeIndex node typeNode
            if mf > 0 then Just (typeNode, mf) else Nothing
            
        typesWithValues = mapMaybe getMutualFulfillment validTypeIds
        
        total = sum $ map snd typesWithValues
        
        normalize (typeNode, value) = (typeNode, if total > 0 then value / total else 0)
    in Map.fromList $ map normalize typesWithValues

-- Create an example tree structure for demonstration
exampleTree :: (Node, TypeIndex)
exampleTree = (finalRoot, finalTypeIndex)
  where
    -- Create root node
    root = createNode "root" "Root" (points 0) Nothing [] Nothing
    
    -- Create type nodes (like Alice, Bob, etc.)
    alice = createNode "alice" "Alice" (points 0) Nothing [] Nothing
    bob = createNode "bob" "Bob" (points 0) Nothing [] Nothing
    
    -- Setup type index with contributors
    initialTypeIndex = Map.empty
    typeIndexWithAlice = addNodeToTypeIndex alice "alice" initialTypeIndex
    typeIndexWithBoth = addNodeToTypeIndex bob "bob" typeIndexWithAlice
    
    -- Add children to root with different recognitions - using the safer Either version
    (rootWithChild1, typeIndex1) = case addChild typeIndexWithBoth root "need1" "Need 1" (points 50) ["alice"] Nothing of
        Right result -> result
        Left err -> error err  -- For demonstration, but in real code would handle this better
        
    (finalRoot, finalTypeIndex) = case addChild typeIndex1 rootWithChild1 "need2" "Need 2" (points 30) ["bob"] Nothing of
        Right result -> result
        Left err -> error err  -- For demonstration

-- Main function to demonstrate tree-based calculations
main :: IO ()
main = do
    putStrLn "Tree-Based Recognition and Fulfillment:"
    let (tree, typeIndex) = exampleTree
        need1 = fromMaybe (error "Need1 not found") $ Map.lookup "need1" (nodeChildren tree)
        need2 = fromMaybe (error "Need2 not found") $ Map.lookup "need2" (nodeChildren tree)
    
    putStrLn $ "Need 1 Fulfillment: " ++ show (fulfilled typeIndex need1)
    putStrLn $ "Need 2 Fulfillment: " ++ show (fulfilled typeIndex need2)
    putStrLn $ "Root Total Fulfillment: " ++ show (fulfilled typeIndex tree)