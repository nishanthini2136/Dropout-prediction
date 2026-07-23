import queue

class StatsNotifier:
    def __init__(self):
        self.listeners = []

    def listen(self):
        q = queue.Queue(maxsize=5)
        self.listeners.append(q)
        return q

    def notify(self):
        # Remove dead queues or queues that are full, or put message
        for q in list(self.listeners):
            try:
                q.put_nowait(True)
            except queue.Full:
                pass
            except Exception:
                if q in self.listeners:
                    self.listeners.remove(q)

    def remove_listener(self, q):
        if q in self.listeners:
            self.listeners.remove(q)

stats_notifier = StatsNotifier()
