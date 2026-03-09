# core/middleware.py
import threading

# Thread-local storage to keep data isolated per request/thread
_thread_locals = threading.local()

def get_current_user():
    """Helper function to retrieve the user inside our signals."""
    return getattr(_thread_locals, 'user', None)

class CurrentUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Store the user in thread-local storage before the view processes it
        _thread_locals.user = getattr(request, 'user', None)
        
        response = self.get_response(request)
        
        # Clean up after the request to prevent data leaking between requests
        if hasattr(_thread_locals, 'user'):
            del _thread_locals.user
            
        return response