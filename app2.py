from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/recognize', methods=['POST'])
def recognize():
    text = request.form.get('text')
    if not text:
        return jsonify({"error": "No text provided"}), 400
    # Optional: log or process the received text
    print("Received text:", text)

    return jsonify({"text": text})

if __name__ == '__main__':
    app.run(debug=True, port=5001)  # Set the port to 5001
