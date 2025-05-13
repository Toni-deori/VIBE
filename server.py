from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import dlib
import os
import pickle
import scipy.spatial
import math
import nltk
from nltk.stem import WordNetLemmatizer
import spacy
from flask import make_response
# nltk.download('wordnet')
nlp = spacy.load('en_core_web_sm')
lemmatizer = WordNetLemmatizer()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load NLP models

# Function to generate frequency matrix
def frequency_matrix(sentences):
    freq_matrix = {}
    stopWords = nlp.Defaults.stop_words

    for sent in sentences:
        freq_table = {}
        words = [word.text.lower() for word in sent if word.text.isalnum()]
        
        for word in words:
            word = lemmatizer.lemmatize(word)
            if word not in stopWords:
                if word in freq_table:
                    freq_table[word] += 1
                else:
                    freq_table[word] = 1

        freq_matrix[sent[:15]] = freq_table

    return freq_matrix

# Function to calculate term frequency (TF)
def tf_matrix(freq_matrix):
    tf_matrix = {}
    for sent, freq_table in freq_matrix.items():
        tf_table = {word: count / len(freq_table) for word, count in freq_table.items()}
        tf_matrix[sent] = tf_table
    return tf_matrix

# Function to calculate sentences per word
def sentences_per_words(freq_matrix):
    word_counts = {}
    for f_table in freq_matrix.values():
        for word in f_table:
            word_counts[word] = word_counts.get(word, 0) + 1
    return word_counts

# Function to calculate inverse document frequency (IDF)
def idf_matrix(freq_matrix, word_counts, total_sentences):
    idf_matrix = {}
    for sent, f_table in freq_matrix.items():
        idf_table = {word: math.log10(total_sentences / float(word_counts[word])) for word in f_table}
        idf_matrix[sent] = idf_table
    return idf_matrix

# Function to calculate TF-IDF matrix
def tf_idf_matrix(tf_matrix, idf_matrix):
    tf_idf_matrix = {}
    for (sent1, tf_table), (sent2, idf_table) in zip(tf_matrix.items(), idf_matrix.items()):
        tf_idf_table = {word: tf_value * idf_table[word] for word, tf_value in tf_table.items()}
        tf_idf_matrix[sent1] = tf_idf_table
    return tf_idf_matrix

# Function to score sentences
def score_sentences(tf_idf_matrix):
    sentence_scores = {}
    for sent, tf_idf_table in tf_idf_matrix.items():
        total_score = sum(tf_idf_table.values())
        sentence_scores[sent] = total_score / len(tf_idf_table) if tf_idf_table else 0
    return sentence_scores

# Function to calculate average score
def average_score(sentence_scores):
    return sum(sentence_scores.values()) / len(sentence_scores)

# Function to create summary
def create_summary(sentences, sentence_scores, threshold):
    summary = []
    for sentence in sentences:
        if sentence[:15] in sentence_scores and sentence_scores[sentence[:15]] >= threshold:
            summary.append(sentence.text)
    return ' '.join(summary)

# Main summary generation function
def generate_summary(text):
    doc = nlp(text)
    sentences = list(doc.sents)
    if not sentences:
        return "No content available for summarization."

    freq_matrix = frequency_matrix(sentences)
    tf_mat = tf_matrix(freq_matrix)
    word_counts = sentences_per_words(freq_matrix)
    idf_mat = idf_matrix(freq_matrix, word_counts, len(sentences))
    tf_idf_mat = tf_idf_matrix(tf_mat, idf_mat)
    sentence_scores = score_sentences(tf_idf_mat)
    avg_score = average_score(sentence_scores)
    threshold = avg_score * 1.3

    return create_summary(sentences, sentence_scores, threshold)

@app.route('/summarize', methods=['POST', 'OPTIONS'])
def handle_summarize():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    text = request.form.get('text', '')
    if not text.strip():
        return jsonify({"error": "No text provided"}), 400

    summary = generate_summary(text)
    response = jsonify({"summary": summary})
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response
# Existing recognize route remains

# Load Dlib models
detector = dlib.get_frontal_face_detector()
shape_predictor = dlib.shape_predictor("models/shape_predictor_68_face_landmarks.dat")
face_rec_model = dlib.face_recognition_model_v1("models/dlib_face_recognition_resnet_model_v1.dat")

# Storage directory for face embeddings
STORAGE_DIR = "storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

def get_face_embedding(image):
    """Extract face embedding from an image."""
    faces = detector(image)
    if len(faces) == 0:
        return None

    embeddings = []
    for face in faces:
        shape = shape_predictor(image, face)
        embeddings.append(np.array(face_rec_model.compute_face_descriptor(image, shape)))

    return embeddings

@app.route('/register', methods=['POST'])
def register_face():
    """Register a new face with a name and condition."""
    file = request.files.get('image')
    name = request.form.get('name')
    condition = request.form.get('condition')  # Get the condition

    if not file or not name or not condition:
        return jsonify({'error': 'Missing image, name, or condition'}), 400

    # Convert image to NumPy array
    np_image = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(np_image, cv2.IMREAD_COLOR)

    # Extract face embedding
    embeddings = get_face_embedding(image)
    if not embeddings:
        return jsonify({'error': 'No face detected'}), 400

    # Save embeddings along with the condition
    for idx, embedding in enumerate(embeddings):
        user_data = {
            'name': name,
            'condition': condition,  # Store the condition
            'embedding': embedding
        }
        with open(os.path.join(STORAGE_DIR, f"{name}_{idx}.pkl"), "wb") as f:
            pickle.dump(user_data, f)

    return jsonify({'message': f'Face registered for {name} with condition {condition}'}), 200

@app.route('/detect', methods=['POST'])
def detect_face():
    """Detect multiple faces and check each one against registered users."""
    file = request.files.get('image')
    if not file:
        return jsonify({'error': 'No image uploaded'}), 400

    # Convert image to NumPy array
    np_image = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(np_image, cv2.IMREAD_COLOR)

    if image is None:
        return jsonify({'error': 'Invalid image format'}), 400

    # Detect all faces in the image
    faces = detector(image)
    detected_users = []

    for face in faces:
        shape = shape_predictor(image, face)
        embedding = np.array(face_rec_model.compute_face_descriptor(image, shape))

        # Compare the detected face with all registered embeddings
        best_match = None
        best_distance = float('inf')
        threshold = 0.6  # Stricter matching threshold

        for filename in os.listdir(STORAGE_DIR):
            if filename.endswith(".pkl"):
                with open(os.path.join(STORAGE_DIR, filename), "rb") as f:
                    user_data = pickle.load(f)
                    stored_embedding = user_data['embedding']
                    distance = scipy.spatial.distance.euclidean(stored_embedding, embedding)

                    if distance < best_distance and distance < threshold:
                        best_distance = distance
                        best_match = user_data

        if best_match:
            detected_users.append(f"{best_match['name']} ({best_match['condition']})")

    if detected_users:
        return jsonify({'message': f'Faces detected: {", ".join(detected_users)}'}), 200
    else:
        return jsonify({'error': 'No matching faces found'}), 400
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
