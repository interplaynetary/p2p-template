import qualified Data.Map.Strict as Map
import qualified Data.Set as Set
import Data.Maybe (fromMaybe, isJust, maybeToList, mapMaybe)
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
data RecognitionTree = RecognitionTree {
    nodeId :: String,
    nodeName :: String,
    nodePoints :: RecognitionPoints,
    nodeParent :: Maybe RecognitionTree,
    nodeChildren :: Map.Map String RecognitionTree,
    nodeTypes :: Set.Set String,  -- Types are referenced by their ID
    nodeManualFulfillment :: Maybe Float
} deriving (Show, Eq, Ord)

-- Type alias for TypeIndex to track instances of each type
type TypeIndex = Map.Map String (Set.Set RecognitionTree)

-- Create a new tree node
createNode :: String -> String -> RecognitionPoints -> Maybe RecognitionTree -> [String] -> Maybe Float -> RecognitionTree
createNode id name points parent types manualFulfillment = 
    RecognitionTree {
        nodeId = id,
        nodeName = name,
        nodePoints = points,
        nodeParent = parent,
        nodeChildren = Map.empty,
        nodeTypes = Set.fromList types,
        nodeManualFulfillment = manualFulfillment
    }

-- Get the root of a tree
getRoot :: RecognitionTree -> RecognitionTree
getRoot = until (isNothing . nodeParent) (fromJust . nodeParent)
  where
    isNothing = null . maybeToList
    fromJust = fromMaybe (error "Unexpected: Parent is Nothing after isNothing check")

-- Check if a node is a contributor (root node)
isContributor :: RecognitionTree -> Bool
isContributor = isNothing . nodeParent
  where
    isNothing = null . maybeToList

-- Check if a node is a contribution (has contributor types and a parent)
isContribution :: RecognitionTree -> TypeIndex -> Bool
isContribution tree typeIndex = not (Set.null $ nodeTypes tree)
                             && hasContributorType
                             && isJust (nodeParent tree)
  where
    hasContributorType = any (hasContributor . (`lookupTypeInstances` typeIndex)) 
                        (Set.toList $ nodeTypes tree)
    hasContributor = any isContributor . Set.toList

-- Safely get instances of a type from TypeIndex
lookupTypeInstances :: String -> TypeIndex -> Set.Set RecognitionTree
lookupTypeInstances = Map.findWithDefault Set.empty

-- Add a child to a tree node
addChild :: RecognitionTree -> String -> String -> RecognitionPoints -> [String] -> Maybe Float -> TypeIndex -> (RecognitionTree, TypeIndex)
addChild parent childId childName childPoints childTypes childManualFulfillment typeIndex
    | isJust (nodeParent parent) && isContribution parent typeIndex =
        error $ "Node " ++ nodeName parent ++ " is an instance of a contributor/contribution and cannot have children."
    | otherwise = (updatedParent, updatedTypeIndex)
  where
    child = createNode childId childName childPoints (Just parent) childTypes childManualFulfillment
    updatedParent = parent { nodeChildren = Map.insert childId child (nodeChildren parent) }
    updatedTypeIndex = foldr' (addNodeToTypeIndex child) typeIndex childTypes

-- Add a node to the type index
addNodeToTypeIndex :: RecognitionTree -> String -> TypeIndex -> TypeIndex
addNodeToTypeIndex node = Map.alter (Just . Set.insert node . fromMaybe Set.empty)

-- Remove a child from a tree node
removeChild :: RecognitionTree -> String -> TypeIndex -> (RecognitionTree, TypeIndex)
removeChild parent childId typeIndex = case Map.lookup childId (nodeChildren parent) of
    Nothing -> (parent, typeIndex)
    Just child -> 
        let updatedParent = parent { nodeChildren = Map.delete childId (nodeChildren parent) }
            updatedTypeIndex = foldr' (removeNodeFromType child) typeIndex (Set.toList $ nodeTypes child)
        in (updatedParent, updatedTypeIndex)

-- Remove a node from a specific type in the index
removeNodeFromType :: RecognitionTree -> String -> TypeIndex -> TypeIndex
removeNodeFromType node = Map.adjust (Set.delete node)

-- Add a type to a node
addType :: RecognitionTree -> String -> TypeIndex -> (RecognitionTree, TypeIndex)
addType node typeId typeIndex
    | Set.member typeId (nodeTypes node) = (node, typeIndex)
    | otherwise = 
        let updatedNode = node { nodeTypes = Set.insert typeId (nodeTypes node) }
        in (updatedNode, addNodeToTypeIndex updatedNode typeId typeIndex)

-- Remove a type from a node
removeType :: RecognitionTree -> String -> TypeIndex -> (RecognitionTree, TypeIndex)
removeType node typeId typeIndex
    | not (Set.member typeId (nodeTypes node)) = (node, typeIndex)
    | otherwise = 
        let updatedNode = node { nodeTypes = Set.delete typeId (nodeTypes node) }
        in (updatedNode, removeNodeFromType node typeId typeIndex)

-- Get a node's total child points
totalChildPoints :: RecognitionTree -> Int
totalChildPoints = sum . map (getPoints . nodePoints) . Map.elems . nodeChildren

-- Calculate a node's weight (proportional importance in the tree)
weight :: RecognitionTree -> Float
weight node = case nodeParent node of
    Nothing -> 1.0  -- Root node has weight 1.0
    Just parent -> 
        let parentTotalPoints = totalChildPoints parent
            nodePointsVal = getPoints (nodePoints node)
        in if parentTotalPoints == 0
           then 0.0
           else (fromIntegral nodePointsVal / fromIntegral parentTotalPoints) * weight parent

-- Calculate a node's share of its parent's total points
shareOfParent :: RecognitionTree -> Float
shareOfParent node = case nodeParent node of
    Nothing -> 1.0  -- Root node has 100% share
    Just parent ->
        let parentTotalPoints = totalChildPoints parent
            nodePointsVal = getPoints (nodePoints node)
        in if parentTotalPoints == 0
           then 0.0
           else fromIntegral nodePointsVal / fromIntegral parentTotalPoints

-- Get children matching a predicate
filterChildren :: (RecognitionTree -> Bool) -> RecognitionTree -> [RecognitionTree]
filterChildren pred = filter pred . Map.elems . nodeChildren

-- Check if any children satisfy a predicate
anyChild :: (RecognitionTree -> Bool) -> RecognitionTree -> Bool
anyChild pred = any pred . Map.elems . nodeChildren

-- Check if a node has direct contribution children
hasDirectContributionChild :: RecognitionTree -> TypeIndex -> Bool
hasDirectContributionChild node typeIndex = 
    anyChild (`isContribution` typeIndex) node

-- Check if a node has non-contribution children
hasNonContributionChild :: RecognitionTree -> TypeIndex -> Bool
hasNonContributionChild node typeIndex = 
    anyChild (not . (`isContribution` typeIndex)) node

-- Calculate the proportion of total child points from contribution children
contributionChildrenWeight :: RecognitionTree -> TypeIndex -> Float
contributionChildrenWeight node typeIndex = ratio contributionPoints totalPoints
  where
    contributionPoints = sum $ map (getPoints . nodePoints) $ 
                         filterChildren (`isContribution` typeIndex) node
    totalPoints = totalChildPoints node
    ratio _ 0 = 0.0
    ratio a b = fromIntegral a / fromIntegral b

-- Sum fulfillment from children matching a predicate
childrenFulfillment :: (RecognitionTree -> Bool) -> RecognitionTree -> TypeIndex -> Float
childrenFulfillment pred node typeIndex =
    sum $ map (\child -> fulfilled typeIndex child * shareOfParent child) $
          filterChildren pred node

-- Calculate the fulfillment from contribution children
contributionChildrenFulfillment :: RecognitionTree -> TypeIndex -> Float
contributionChildrenFulfillment node typeIndex = 
    childrenFulfillment (`isContribution` typeIndex) node typeIndex

-- Calculate the fulfillment from non-contribution children
nonContributionChildrenFulfillment :: RecognitionTree -> TypeIndex -> Float
nonContributionChildrenFulfillment node typeIndex =
    childrenFulfillment (not . (`isContribution` typeIndex)) node typeIndex

-- Calculate the fulfillment of a node (core recursive function)
fulfilled :: TypeIndex -> RecognitionTree -> Float
fulfilled typeIndex node
    -- Leaf nodes
    | Map.null (nodeChildren node) = 
        if isContribution node typeIndex then 1.0 else 0.0
    
    -- Nodes with manual fulfillment and contributor children
    | isJust (nodeManualFulfillment node) && hasDirectContributionChild node typeIndex = 
        let manualFulfillment = fromMaybe 0.0 (nodeManualFulfillment node)
        in if not (hasNonContributionChild node typeIndex)
           then manualFulfillment
           else 
               let contribWeight = contributionChildrenWeight node typeIndex
                   nonContribFulfillment = nonContributionChildrenFulfillment node typeIndex
               in manualFulfillment * contribWeight + nonContribFulfillment * (1.0 - contribWeight)
    
    -- Default case: weighted sum of all children's fulfillment
    | otherwise = 
        sum $ map (\child -> fulfilled typeIndex child * shareOfParent child) $
              Map.elems (nodeChildren node)

-- Calculate the desire (unfulfilled need) of a node
desire :: TypeIndex -> RecognitionTree -> Float
desire typeIndex = (1.0 -) . fulfilled typeIndex

-- Calculate the fulfillment weight (fulfilled * weight)
fulfillmentWeight :: TypeIndex -> RecognitionTree -> Float
fulfillmentWeight typeIndex node = fulfilled typeIndex node * weight node

-- Get all instances of a given type
getInstances :: RecognitionTree -> String -> TypeIndex -> Set.Set RecognitionTree
getInstances _ = lookupTypeInstances

-- Calculate a node's share of general fulfillment from another type
shareOfGeneralFulfillment :: RecognitionTree -> RecognitionTree -> TypeIndex -> Float
shareOfGeneralFulfillment node typeNode typeIndex =
    getInstances node (nodeId typeNode) typeIndex
    & Set.toList
    & map calculateInstanceShare
    & sum
  where
    calculateInstanceShare instance_ = 
        let contributorTypes = Set.filter (hasContributor . (`lookupTypeInstances` typeIndex)) 
                              (nodeTypes instance_)
            contributorTypesCount = Set.size contributorTypes
            fWeight = fulfilled typeIndex instance_ * weight instance_
        in if contributorTypesCount > 0
           then fWeight / fromIntegral contributorTypesCount
           else fWeight
    hasContributor = any isContributor . Set.toList

-- Calculate mutual fulfillment between two nodes
mutualFulfillment :: RecognitionTree -> RecognitionTree -> TypeIndex -> Float
mutualFulfillment node1 node2 typeIndex =
    min (shareOfGeneralFulfillment node1 node2 typeIndex)
        (shareOfGeneralFulfillment node2 node1 typeIndex)

-- Calculate mutual fulfillment distribution
mutualFulfillmentDistribution :: RecognitionTree -> TypeIndex -> Map.Map RecognitionTree Float
mutualFulfillmentDistribution node typeIndex =
    let validTypeIds = filter (not . Set.null . (`lookupTypeInstances` typeIndex)) 
                             (Map.keys typeIndex)
        
        getTypeNode = head . Set.toList . (`lookupTypeInstances` typeIndex)
        
        getMutualFulfillment typeId = 
            let typeNode = getTypeNode typeId
                mf = mutualFulfillment node typeNode typeIndex
            in if mf > 0 then Just (typeNode, mf) else Nothing
            
        typesWithValues = mapMaybe getMutualFulfillment validTypeIds
        
        total = sum $ map snd typesWithValues
        
        normalize (typeNode, value) = (typeNode, if total > 0 then value / total else 0)
    in Map.fromList $ map normalize typesWithValues

-- Create an example tree structure for demonstration
exampleTree :: (RecognitionTree, TypeIndex)
exampleTree = (finalRoot, finalTypeIndex)
  where
    -- Create root node
    root = createNode "root" "Root" (points 0) Nothing [] Nothing
    
    -- Create type nodes (like Alice, Bob, etc.)
    alice = createNode "alice" "Alice" (points 0) Nothing [] Nothing
    bob = createNode "bob" "Bob" (points 0) Nothing [] Nothing
    
    -- Setup type index with contributors
    initialTypeIndex = Map.empty
                     & addNodeToTypeIndex alice "alice" 
                     & addNodeToTypeIndex bob "bob"
    
    -- Add children to root with different recognitions
    (rootWithChild1, typeIndex1) = addChild root "need1" "Need 1" (points 50) ["alice"] Nothing initialTypeIndex
    (finalRoot, finalTypeIndex) = addChild rootWithChild1 "need2" "Need 2" (points 30) ["bob"] Nothing typeIndex1

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