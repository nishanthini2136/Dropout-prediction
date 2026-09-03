import os
import struct

def parse_mp4_duration(filepath):
    """
    Parse an MP4 / M4V / MOV file's binary atom tree to extract exact duration in seconds.
    Searches recursively or sequentially for 'moov' -> 'mvhd' atom header.
    """
    try:
        with open(filepath, 'rb') as f:
            f.seek(0, os.SEEK_END)
            file_size = f.tell()
            f.seek(0)
            
            return _find_mvhd_in_container(f, 0, file_size)
    except Exception as e:
        print(f"[media_utils] Failed to parse MP4 duration for {filepath}: {e}")
        return None

def _find_mvhd_in_container(f, start_offset, end_offset):
    curr = start_offset
    while curr < end_offset:
        f.seek(curr)
        header = f.read(8)
        if len(header) < 8:
            break
        
        atom_size = struct.unpack('>I', header[:4])[0]
        atom_type = header[4:8]
        header_size = 8
        
        if atom_size == 1:
            # Extended 64-bit size
            large_header = f.read(8)
            if len(large_header) < 8:
                break
            atom_size = struct.unpack('>Q', large_header)[0]
            header_size = 16
        elif atom_size == 0:
            # Atom extends to end of file
            atom_size = end_offset - curr
            
        if atom_size < header_size:
            break
            
        if atom_type == b'moov':
            # Inspect inside moov container
            res = _find_mvhd_in_container(f, curr + header_size, curr + atom_size)
            if res is not None:
                return res
        elif atom_type == b'mvhd':
            # Parse mvhd atom
            version_byte = f.read(1)
            if not version_byte:
                break
            version = struct.unpack('>B', version_byte)[0]
            f.read(3)  # Skip 3 bytes of flags
            
            if version == 0:
                # 32-bit creation & modification time (8 bytes)
                f.read(8)
                timescale_duration = f.read(8)
                if len(timescale_duration) == 8:
                    timescale, duration = struct.unpack('>II', timescale_duration)
                    if timescale > 0:
                        return duration / float(timescale)
            elif version == 1:
                # 64-bit creation & modification time (16 bytes)
                f.read(16)
                timescale_data = f.read(4)
                duration_data = f.read(8)
                if len(timescale_data) == 4 and len(duration_data) == 8:
                    timescale = struct.unpack('>I', timescale_data)[0]
                    duration = struct.unpack('>Q', duration_data)[0]
                    if timescale > 0:
                        return duration / float(timescale)
            return None
            
        curr += atom_size
    return None

def format_video_duration(seconds):
    """
    Format a duration in seconds into human-readable format.
    e.g. 75.4 -> '1 min 15 sec', 600 -> '10 min', 3665 -> '1h 01m 05s'
    """
    if seconds is None or seconds <= 0:
        return "Unknown duration"
    
    total_seconds = int(round(seconds))
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    
    if hours > 0:
        if secs > 0:
            return f"{hours}h {minutes:02d}m {secs:02d}s"
        elif minutes > 0:
            return f"{hours}h {minutes:02d}m"
        else:
            return f"{hours}h"
    elif minutes > 0:
        if secs > 0:
            return f"{minutes} min {secs} sec"
        else:
            return f"{minutes} min"
    else:
        return f"{secs} sec"

_DURATION_CACHE = {}

def get_file_duration_formatted(filepath):
    """Detect and format exact duration of a local video file with mtime caching."""
    if not os.path.exists(filepath):
        return None
    
    ext = os.path.splitext(filepath)[1].lower()
    if ext in ('.mp4', '.m4v', '.mov'):
        try:
            mtime = os.path.getmtime(filepath)
            cached = _DURATION_CACHE.get(filepath)
            if cached and cached[0] == mtime:
                return cached[1]
            
            duration_sec = parse_mp4_duration(filepath)
            if duration_sec is not None:
                formatted = format_video_duration(duration_sec)
                _DURATION_CACHE[filepath] = (mtime, formatted)
                return formatted
        except Exception as e:
            print(f"[media_utils] Duration error for {filepath}: {e}")
    
    return None

