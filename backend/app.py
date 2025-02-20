from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
import torch
from langchain_community.llms import Ollama
from langchain_community.vectorstores import Chroma
from langchain_community.llms import HuggingFacePipeline
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_community.document_loaders import PDFPlumberLoader
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from langchain.prompts import PromptTemplate
import uuid
from data_ingestion import pdfProcess
import re
app = Flask(__name__)
CORS(app)
folder_path = "db"
device = torch.device('cpu')



checkpoint = "MBZUAI/LaMini-T5-738M"
tokenizer = AutoTokenizer.from_pretrained(checkpoint)
base_model = AutoModelForSeq2SeqLM.from_pretrained(checkpoint, torch_dtype=torch.float32)

def llm_pipeline():
    pipe = pipeline(
        'text2text-generation',
        model=base_model,
        tokenizer=tokenizer,
        max_length=256,
        do_sample=True,
        temperature=0.3,
        top_p=0.95
       
    )
    local_llm = HuggingFacePipeline(pipeline=pipe)
    return local_llm

cached_llm = Ollama(model="llama3")

# cached_llm = llm_pipeline()
embedding = FastEmbedEmbeddings()


text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1024, chunk_overlap=80, length_function=len, is_separator_regex=False
)


raw_prompt = PromptTemplate.from_template(
    """ 
    <s>[INST] You are a technical assistant good at searching docuemnts. If you do not have an answer from the provided information say so. [/INST] </s>
    [INST] {input}
           Context: {context}
           Answer:
    [/INST]
"""
)



import sqlite3

# Initialize the database connection
def init_db():
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    
    # Create table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            chat_thread_id TEXT PRIMARY KEY,
            asset_id TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_thread_id TEXT NOT NULL,
            user_message TEXT,
            bot_response TEXT,
            FOREIGN KEY (chat_thread_id) REFERENCES chat_sessions (chat_thread_id)
        )
    ''')
    
    conn.commit()
    conn.close()

init_db()

def store_chat_session(chat_thread_id, asset_id):
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    
    # Insert the new chat session into the database
    cursor.execute('''
        INSERT INTO chat_sessions (chat_thread_id, asset_id)
        VALUES (?, ?)
    ''', (chat_thread_id, asset_id))
    
    conn.commit()
    conn.close()


def get_asset_id_by_chat_thread_id(chat_thread_id):
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    
    # Retrieve the asset ID associated with the given chat thread ID
    cursor.execute('''
        SELECT asset_id FROM chat_sessions WHERE chat_thread_id = ?
    ''', (chat_thread_id,))
    
    result = cursor.fetchone()
    conn.close()
    
    if result:
        return result[0]  # Return the asset_id
    else:
        return None  # Handle the case where the chat_thread_id is not found
    
def store_chat_message(chat_thread_id, user_message, bot_response):
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO chat_history (chat_thread_id, user_message, bot_response)
        VALUES (?, ?, ?)
    ''', (chat_thread_id, user_message, bot_response))
    
    conn.commit()
    conn.close()

def get_chat_history(chat_thread_id):
    conn = sqlite3.connect('chat_data.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT user_message, bot_response FROM chat_history
        WHERE chat_thread_id = ?
        ORDER BY id
    ''', (chat_thread_id,))
    
    result = cursor.fetchall()
    conn.close()
    
    return result

@app.route("/api/documents/process", methods=["POST"])
def pdfPost():
    response_dict = {}
    pdfProcess(response_dict)
    return jsonify(response_dict)
    

@app.route("/api/chat/start", methods=["POST"])
def startChat():
    json_content = request.json
    asset_id = json_content.get("asset_id")

    chat_thread_id = str(uuid.uuid4())

    print(f"Generated chat_thread_id: {chat_thread_id}")
    print(f"asset_id: {asset_id}")

    store_chat_session(chat_thread_id, asset_id)

    response = {
        "chat_thread_id": chat_thread_id  # Return the chat thread ID
    }
    return jsonify(response)

@app.route("/api/chat/message", methods=["POST"])
def sendMessage():
    json_content = request.json
    chat_thread_id = json_content.get("chat_thread_id")  # Extracting the chat thread ID
    query = json_content.get("query")  # Extracting the user message

    print(f"chat_thread_id: {chat_thread_id}")
    print(f"query: {query}")

    # Retrieve the asset_id based on chat_thread_id from the database
    asset_id = get_asset_id_by_chat_thread_id(chat_thread_id)
    
    if not asset_id:
        return jsonify({"error": "Invalid chat_thread_id"}), 400

    history = get_chat_history(chat_thread_id)
    history_context = ""
    for user_message, bot_response in history:
        history_context += f"User: {user_message}\nAssistant: {bot_response}\n"

    # Add the current query to the context
    history_context += f"User: {query}\n"

    print("Loading vector store")
    vector_store = Chroma(
        persist_directory=f"{folder_path}/{asset_id}",  # Use asset ID to locate the correct vector store
        embedding_function=embedding
    )
    print("Creating chain")
    retriever = vector_store.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={
            "k": 20,
            "score_threshold": 0.1,
        },
    )

    document_chain = create_stuff_documents_chain(cached_llm, raw_prompt)
    chain = create_retrieval_chain(retriever, document_chain)

    result = chain.invoke({"input": query, "context": history_context})

    print(result)

    sources = []
    for doc in result["context"]:
        sources.append(
            {"source": doc.metadata["source"], "page_content": doc.page_content}
        )

    response_answer = {
        "answer": result["answer"],
        "sources": sources
    }
    store_chat_message(chat_thread_id, query, result["answer"])
    return jsonify(response_answer)

@app.route("/api/chat/history", methods=["GET"])
def getChatHistory():
    chat_thread_id = request.args.get("chat_thread_id")
    
    history = get_chat_history(chat_thread_id)
    
    if not history:
        return jsonify({"error": "No history found for this chat thread"}), 404

    response = []
    for user_message, bot_response in history:
        response.append({
            "user_message": user_message,
            "bot_response": bot_response
        })
    
    return jsonify(response)

@app.route("/api/documents/generate_questions", methods=["POST"])
def generate_questions():
    json_content = request.json
    asset_id = json_content.get("asset_id")

    if not asset_id:
        return jsonify({"error": "asset_id is required"}), 400

    # Load the vector store for the given asset_id
    try:
        vector_store = Chroma(
            persist_directory=f"{folder_path}/{asset_id}",
            embedding_function=embedding
        )
    except Exception as e:
        return jsonify({"error": "Could not load vector store", "details": str(e)}), 500

    # Access the underlying Chroma collection
    try:
        collection = vector_store._collection
        results = collection.get(include=["documents", "metadatas"])
        docs = results.get("documents", [])
        metadatas = results.get("metadatas", [])
    except Exception as e:
        return jsonify({"error": "Could not retrieve documents", "details": str(e)}), 500

    if not docs:
        return jsonify({"error": "No documents found for the provided asset_id"}), 404

    # Concatenate all document contents
    full_text = "\n".join(docs)

    # Summarize the full text to fit the model's input size
    summarize_prompt = (
        "Please provide a concise summary of the following document:\n\n"
        f"{full_text}\n\nSummary:"
    )
    try:
        summary = cached_llm(summarize_prompt)
        print(f"Summary: {summary}")
    except Exception as e:
        return jsonify({"error": "Summarization failed", "details": str(e)}), 500

    # Generate questions based on the summary
    questions_prompt = (
        "Based on the following summary of a document, generate a list of insightful questions "
        "that could be used to test comprehension or explore the topic further:\n\n"
        f"{summary}\n\nQuestions:"
    )
    try:
        questions_text = cached_llm(questions_prompt)
        print(f"Questions Text: {questions_text}")
    except Exception as e:
        return jsonify({"error": "Question generation failed", "details": str(e)}), 500

    # Split the generated text into a list of questions
    questions_list = [q.strip() for q in questions_text.split('\n') if q.strip()]

    # Optional: Remove any numbering or bullet points
    cleaned_questions = []
    for q in questions_list:
        # Remove common bullet points or numbering using regex
        q = re.sub(r'^[-•*0-9.\s]+', '', q)
        cleaned_questions.append(q)

    return jsonify({"questions": cleaned_questions})
def start_app():
    app.run(host="0.0.0.0", port=8080, debug=True)


if __name__ == "__main__":
    start_app()