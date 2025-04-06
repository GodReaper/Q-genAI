
from langchain_community.llms import Ollama

class FillInTheBlankAgent:
    def __init__(self, model="llama3"):
        self.llm = Ollama(model=model)
    
    def generate_fill_in_the_blank(self, text):
        prompt = f"Generate fill-in-the-blank questions based on the following text:\n\n{text}\n\nQuestions:"
        fill_in_the_blank_questions = self.llm(prompt)
        return fill_in_the_blank_questions
