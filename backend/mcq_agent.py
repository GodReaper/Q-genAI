
from langchain_community.llms import Ollama

class MCQAgent:
    def __init__(self, model="llama3"):
        self.llm = Ollama(model=model)
    
    def generate_mcq(self, text):
        prompt = f"Generate multiple-choice questions based on the following text:\n\n{text}\n\nQuestions:"
        mcq_questions = self.llm(prompt)
        return mcq_questions


