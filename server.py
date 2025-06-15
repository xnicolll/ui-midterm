# Joe Nicol
from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__)

# Helper Functions
def load_data():
    try:
        with open('data.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Error: data.json not found")
        return {}
    except json.JSONDecodeError:
        print("Error: Invalid JSON in data.json")
        return {}

def save_data(data):
    with open('data.json', 'w') as f:
        json.dump(data, f, indent=4)

def validate_form_data(form_data, data=None):
    errors = {}
    
    # Required fields
    required_fields = ['name', 'location', 'image', 'alt_text', 'rating', 
                      'summary', 'information', 'average cost']
    for field in required_fields:
        if not form_data.get(field, '').strip():
            errors[field] = f"{field.title()} is required"
    
    # Rating validation
    try:
        rating = float(form_data.get('rating', ''))
        if not (0 <= rating <= 10):
            errors['rating'] = "Rating must be between 0 and 10"
    except ValueError:
        errors['rating'] = "Rating must be a number"
    
    # Target traveller validation
    travellers = form_data.get('target traveller', [])
    if not travellers or not isinstance(travellers, list):
        errors['target traveller'] = "At least one traveller type is required"
    
    # Similar places validation
    if data:
        similar_places = form_data.get('similar place ids', [])
        if len(similar_places) > 3:
            errors['similar place ids'] = "Maximum 3 similar places allowed"
        elif not all(place_id in data for place_id in similar_places):
            errors['similar place ids'] = "Invalid place selection"
    
    return errors

# Routes
@app.route('/')
def home():
    data = load_data()
    popular_places = sorted(data.values(), key=lambda x: float(x['rating']), reverse=True)[:3]
    return render_template('index.html', popular_places=popular_places)

@app.route('/search')
def search():
    data = load_data()
    query = request.args.get('q', '').strip().lower()
    if not query:
        return render_template('search.html', query='', results=[], count=0)
    
    results = []
    for item in data.values():
        if (query in item['name'].lower() or 
            query in item['location'].lower() or 
            any(query in traveller.lower() for traveller in item['target traveller'])):
            results.append(item)
    
    return render_template('search.html', query=query, results=results, count=len(results))

@app.route('/view/<id>')
def view(id):
    data = load_data()
    if id in data:
        return render_template('view.html', place=data[id], data=data)
    return "Place not found", 404

@app.route('/add', methods=['GET'])
def add_form():
    data = load_data()
    places = [{'id': k, 'name': v['name'], 'location': v['location']} 
              for k, v in data.items()]
    return render_template('add.html', places=places)

@app.route('/api/add', methods=['POST'])
def add_place():
    data = load_data()
    form_data = request.json
    
    errors = validate_form_data(form_data, data)
    
    if errors:
        return jsonify({'success': False, 'errors': errors}), 400
    
    # Generate new ID
    new_id = str(max(int(id) for id in data.keys()) + 1)
    
    # Create new entry
    new_place = {
        'id': new_id,
        'name': form_data['name'].strip(),
        'location': form_data['location'].strip(),
        'image': form_data['image'].strip(),
        'alt_text': form_data['alt_text'].strip(),
        'rating': form_data['rating'].strip(),
        'summary': form_data['summary'].strip(),
        'information': form_data['information'].strip(),
        'average cost': form_data['average cost'].strip(),
        'target traveller': form_data['target traveller'],
        'similar place ids': form_data['similar place ids']
    }
    
    # Save to data
    data[new_id] = new_place
    
    # Update similar places to include this new place
    for similar_id in new_place['similar place ids']:
        if len(data[similar_id]['similar place ids']) < 3:
            if new_id not in data[similar_id]['similar place ids']:
                data[similar_id]['similar place ids'].append(new_id)
    
    save_data(data)
    
    return jsonify({
        'success': True,
        'message': 'Place added successfully',
        'id': new_id
    })

@app.route('/autocomplete')
def autocomplete():
    data = load_data()
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify([])
    
    suggestions = [
        {
            'id': item['id'],
            'name': item['name'],
            'location': item['location']
        }
        for item in data.values()
        if query in item['name'].lower()
    ]
    return jsonify(suggestions[:5])

@app.route('/api/popular-places')
def get_popular_places():
    data = load_data()
    popular_places = sorted(data.values(), key=lambda x: float(x['rating']), reverse=True)[:3]
    return jsonify(popular_places)

@app.route('/edit/<id>')
def edit(id):
    data = load_data()
    if id in data:
        places = [{'id': k, 'name': v['name'], 'location': v['location']} 
                 for k, v in data.items()]
        return render_template('edit.html', place=data[id], places=places)
    return "Place not found", 404

@app.route('/api/edit/<id>', methods=['POST'])
def api_edit(id):
    data = load_data()
    if id not in data:
        return jsonify({'success': False, 'errors': {'general': 'Place not found'}}), 404

    form_data = request.json
    
    # Validation
    errors = validate_form_data(form_data, data)
    
    if errors:
        return jsonify({'success': False, 'errors': errors}), 400
    
    # Remove this place from other places' similar lists
    for place in data.values():
        if id in place['similar place ids']:
            place['similar place ids'].remove(id)
    
    # Update the place data
    data[id].update({
        'name': form_data['name'].strip(),
        'location': form_data['location'].strip(),
        'image': form_data['image'].strip(),
        'alt_text': form_data['alt_text'].strip(),
        'rating': form_data['rating'].strip(),
        'summary': form_data['summary'].strip(),
        'information': form_data['information'].strip(),
        'average cost': form_data['average cost'].strip(),
        'target traveller': form_data['target traveller'],
        'similar place ids': form_data['similar place ids']
    })
    
    # Update similar places to include this place
    for similar_id in form_data['similar place ids']:
        if len(data[similar_id]['similar place ids']) < 3:
            if id not in data[similar_id]['similar place ids']:
                data[similar_id]['similar place ids'].append(id)
    
    save_data(data)
    
    return jsonify({
        'success': True,
        'message': 'Place updated successfully'
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)
