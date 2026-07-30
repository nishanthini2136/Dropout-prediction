from config.database import db
from bson.objectid import ObjectId
import os
from datetime import datetime

UPLOAD_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'static', 'uploads'))

class MediaModel:
    def __init__(self):
        self.collection = db.get_collection('media')

    def save_file(self, file_storage, course_id: str, module_id: str, media_type: str):
        """Save uploaded file to filesystem and create a media document.
        file_storage: Werkzeug FileStorage object
        media_type: 'video', 'pdf', 'ppt', 'resource'
        """
        # Ensure upload directory exists
        course_dir = os.path.join(UPLOAD_ROOT, str(course_id))
        module_dir = os.path.join(course_dir, str(module_id))
        os.makedirs(module_dir, exist_ok=True)
        # Use a timestamped filename to avoid collisions
        filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file_storage.filename}"
        file_path = os.path.join(module_dir, filename)
        file_storage.save(file_path)
        # Build URL relative to static folder (Flask will serve /static/...)
        url = f"/static/uploads/{course_id}/{module_id}/{filename}"
        media_doc = {
            'course_id': ObjectId(course_id),
            'module_id': ObjectId(module_id),
            'type': media_type,
            'filename': filename,
            'url': url,
            'uploaded_at': datetime.utcnow()
        }
        result = self.collection.insert_one(media_doc)
        media_doc['_id'] = result.inserted_id
        return media_doc

    def get_media_by_module(self, module_id: str):
        # Try ObjectId lookup first
        try:
            return list(self.collection.find({'module_id': ObjectId(module_id)}))
        except:
            # If that fails, try direct lookup (for integer/string module IDs)
            return list(self.collection.find({'module_id': module_id}))

    def delete_media(self, media_id: str):
        doc = self.collection.find_one({'_id': ObjectId(media_id)})
        if not doc:
            return None
        # Delete file from filesystem
        file_path = os.path.abspath(os.path.join(UPLOAD_ROOT, str(doc['course_id']), str(doc['module_id']), doc['filename']))
        if os.path.exists(file_path):
            os.remove(file_path)
        return self.collection.delete_one({'_id': ObjectId(media_id)})

    def delete_media_by_module(self, module_id: str):
        # Try ObjectId lookup first
        try:
            medias = list(self.collection.find({'module_id': ObjectId(module_id)}))
        except:
            # If that fails, try direct lookup (for integer/string module IDs)
            medias = list(self.collection.find({'module_id': module_id}))
        
        for m in medias:
            self.delete_media(str(m['_id']))
        return len(medias)
