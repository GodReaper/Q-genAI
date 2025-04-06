For math question generation, the question should be an actual solvable question 
Thats why we need the model to be able to not hallucinate and properly create a problem which has a solution (which means it needs to be able to solve)

some way that allows adding symbolic reasoning by using graph to existing LLM for adding a layer of determinism so that it doesn’t give varying results which is 
LangChain + Neo4j / GraphRAG
if integrating multiple LLM and giving best answer out of them by comparison is not feasible due to uncertainty factors or whatever, how about just making the product detect if it’s a math or non math question and choose between neural network LLM and a deterministic model