# BOST Manifest - MongoDB Audit & Attachment Service
# Author: Kwame Agyeman

import logging
from datetime import datetime, timezone
from django.conf import settings

logger = logging.getLogger('bost_manifest')


class MongoDBService:
    _instance = None
    _client = None
    _db = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBService, cls).__new__(cls)
            # Per-instance, not per-class: a class-level dict is shared by every
            # instance and never cleared, which leaks state between tests and
            # grows without bound when MongoDB is unavailable.
            cls._instance.reset_fallback()
            cls._instance._init_connection()
        return cls._instance

    def reset_fallback(self):
        """Clear the in-memory store. Called on init and between tests."""
        self._in_memory_fallback = {
            'audit_logs': [],
            'document_attachments': [],
            'exception_reports': [],
        }

    def _init_connection(self):
        try:
            from pymongo import MongoClient
            mongo_uri = getattr(settings, 'MONGO_URI', 'mongodb://localhost:27017/')
            db_name = getattr(settings, 'MONGO_DB_NAME', 'bost_manifest_docs')
            
            client_kwargs = {'serverSelectionTimeoutMS': 3000}
            try:
                import certifi
                client_kwargs['tlsCAFile'] = certifi.where()
            except ImportError:
                pass

            self._client = MongoClient(mongo_uri, **client_kwargs)
            self._client.admin.command('ping')
            self._db = self._client[db_name]
            logger.info("Connected to MongoDB: %s", db_name)
        except Exception as e:
            logger.warning("MongoDB unavailable (%s). Fallback mode active.", e)
            self._client = None
            self._db = None

    @property
    def is_connected(self):
        return self._db is not None

    def get_collection(self, collection_name):
        if self.is_connected:
            return self._db[collection_name]
        return None

    def log_audit_event(self, entity_type, entity_id, previous_state, new_state, user_id=None, user_role=None, ip_address=None, user_agent=None, correlation_id=None, notes=None):
        doc = {
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "previous_state": previous_state,
            "new_state": new_state,
            "user_id": user_id,
            "user_role": user_role,
            "ip_address": ip_address or "127.0.0.1",
            "user_agent": user_agent or "Internal",
            "correlation_id": correlation_id,
            "notes": notes,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if self.is_connected:
            try:
                result = self._db['audit_logs'].insert_one(doc)
                doc['_id'] = str(result.inserted_id)
                logger.info("Audit log saved: entity=%s id=%s (%s -> %s)", entity_type, entity_id, previous_state, new_state)
            except Exception as err:
                logger.error("Error writing audit log: %s", err)
        else:
            self._in_memory_fallback['audit_logs'].append(doc)
            logger.info("Audit log saved in-memory: entity=%s id=%s (%s -> %s)", entity_type, entity_id, previous_state, new_state)

        return doc

    def get_audit_trail(self, entity_type, entity_id):
        if self.is_connected:
            query = {"entity_type": entity_type, "entity_id": str(entity_id)}
            return list(self._db['audit_logs'].find(query, {"_id": 0}).sort("timestamp", 1))
        else:
            return [
                log for log in self._in_memory_fallback['audit_logs']
                if log["entity_type"] == entity_type and log["entity_id"] == str(entity_id)
            ]

    def save_attachment(self, entity_type, entity_id, document_type, filename, metadata, uploaded_by):
        doc = {
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "document_type": document_type,
            "filename": filename,
            "metadata": metadata or {},
            "uploaded_by": uploaded_by,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        if self.is_connected:
            result = self._db['document_attachments'].insert_one(doc)
            doc['id'] = str(result.inserted_id)
            if '_id' in doc:
                del doc['_id']
        else:
            doc['id'] = f"mem_doc_{len(self._in_memory_fallback['document_attachments']) + 1}"
            self._in_memory_fallback['document_attachments'].append(doc)

        return doc

    def get_attachments(self, entity_type, entity_id):
        if self.is_connected:
            query = {"entity_type": entity_type, "entity_id": str(entity_id)}
            records = list(self._db['document_attachments'].find(query))
            for r in records:
                r['id'] = str(r.pop('_id'))
            return records
        else:
            return [
                att for att in self._in_memory_fallback['document_attachments']
                if att["entity_type"] == entity_type and att["entity_id"] == str(entity_id)
            ]


mongo_service = MongoDBService()
