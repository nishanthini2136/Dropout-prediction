import os
import sys

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak, KeepTogether
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def generate_course_pdf(filepath, course_title, course_code, doc_type, modules_info=None):
    """
    Generates a high-quality multi-page PDF document for course materials.
    doc_type: 'syllabus' | 'reference' | 'exercises'
    """
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    if REPORTLAB_AVAILABLE:
        return _generate_with_reportlab(filepath, course_title, course_code, doc_type, modules_info)
    else:
        return _generate_fallback_pdf(filepath, course_title, course_code, doc_type)


def _generate_with_reportlab(filepath, title, code, doc_type, modules_info=None):
    doc = SimpleDocTemplate(
        filepath,
        pagesize=letter,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#1E293B")  # Slate 800
    accent_color = colors.HexColor("#2563EB")   # Blue 600
    gold_color = colors.HexColor("#D97706")     # Amber 600
    dark_gray = colors.HexColor("#334155")
    light_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=gold_color,
        spaceAfter=12
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=accent_color,
        spaceBefore=14,
        spaceAfter=8
    )

    h3_style = ParagraphStyle(
        'Heading3_Custom',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=primary_color,
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=dark_gray,
        spaceAfter=6
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0F172A"),
        backColor=colors.HexColor("#F1F5F9"),
        borderPadding=6,
        spaceAfter=8
    )

    elements = []

    # Document Header
    doc_type_names = {
        'syllabus': 'OFFICIAL COURSE SYLLABUS & CURRICULUM GUIDE',
        'reference': 'COMPREHENSIVE REFERENCE MATERIALS & CHEAT SHEET',
        'exercises': 'PRACTICE EXERCISES, LABS & SOLUTION GUIDE'
    }
    header_label = doc_type_names.get(doc_type.lower(), 'COURSE RESOURCE DOCUMENT')

    elements.append(Paragraph(f"{code} — {title}", title_style))
    elements.append(Paragraph(header_label, subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=accent_color, spaceBefore=4, spaceAfter=12))

    # Meta Table
    meta_data = [
        [
            Paragraph("<b>Course Code:</b> " + code, body_style),
            Paragraph("<b>Category:</b> Computer Science & Tech", body_style)
        ],
        [
            Paragraph("<b>Academic Term:</b> 2026 Academic Year", body_style),
            Paragraph("<b>Format:</b> E-Learning / Self-Paced", body_style)
        ],
        [
            Paragraph("<b>Prerequisites:</b> Basic Problem Solving", body_style),
            Paragraph("<b>Estimated Hours:</b> 40 Hours Content", body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[3.75 * inch, 3.75 * inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), light_bg),
        ('BOX', (0, 0), (-1, -1), 1, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, border_color),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 14))

    # Content generation based on doc_type
    if doc_type.lower() == 'syllabus':
        _build_syllabus_content(elements, title, code, modules_info, h2_style, h3_style, body_style, code_style, primary_color, border_color, light_bg)
    elif doc_type.lower() == 'reference':
        _build_reference_content(elements, title, code, modules_info, h2_style, h3_style, body_style, code_style, primary_color, border_color, light_bg)
    else:  # exercises
        _build_exercises_content(elements, title, code, modules_info, h2_style, h3_style, body_style, code_style, primary_color, border_color, light_bg)

    # Footer note
    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceBefore=10, spaceAfter=8))
    elements.append(Paragraph(
        f"<i>Confidential & Proprietary — E-Learning Management System Portal. Generated for course {code}. All rights reserved.</i>",
        ParagraphStyle('Footer', parent=body_style, fontSize=8, leading=10, textColor=colors.HexColor("#94A3B8"), alignment=1)
    ))

    doc.build(elements)
    return True


def _build_syllabus_content(elements, title, code, modules_info, h2_style, h3_style, body_style, code_style, primary_color, border_color, light_bg):
    elements.append(Paragraph("1. Course Description & Learning Objectives", h2_style))
    elements.append(Paragraph(
        f"Welcome to <b>{title} ({code})</b>! This course is designed to equip students with deep theoretical understanding and practical hands-on proficiency. "
        "By completing this curriculum, learners will master key concepts, build industry-standard projects, and develop problem-solving skills necessary for professional software development.",
        body_style
    ))
    
    elements.append(Paragraph("Key Learning Outcomes:", h3_style))
    outcomes = [
        "• Master foundational and advanced topics through structured video lectures and interactive materials.",
        "• Apply theoretical principles to real-world coding projects and algorithmic problem solving.",
        "• Understand best practices, debugging strategies, and architectural design patterns.",
        "• Pass comprehensive evaluations and earn official course certification."
    ]
    for item in outcomes:
        elements.append(Paragraph(item, body_style))
        
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("2. Course Modules & Detailed Schedule", h2_style))

    if not modules_info:
        modules_info = [
            {"title": "Module 1: Foundations & Environment Setup", "desc": "Introduction to key concepts, installing dependencies, basic syntax and initial projects."},
            {"title": "Module 2: Core Data Structures & Control Flow", "desc": "Conditionals, loops, functions, lists, dicts, memory management and standard libraries."},
            {"title": "Module 3: Object-Oriented & Modular Architecture", "desc": "Classes, inheritance, encapsulation, design patterns, and package management."},
            {"title": "Module 4: Practical Applications & Capstone Project", "desc": "Building end-to-end applications, testing, optimization, and final deployment."}
        ]

    table_data = [[
        Paragraph("<b>Module / Topic</b>", h3_style),
        Paragraph("<b>Key Topics & Assignments</b>", h3_style),
        Paragraph("<b>Weightage</b>", h3_style)
    ]]

    for idx, mod in enumerate(modules_info, 1):
        m_title = mod.get('title', f"Module {idx}")
        m_desc = mod.get('desc', 'In-depth lectures, reading materials, and hands-on coding exercises.')
        table_data.append([
            Paragraph(f"<b>{m_title}</b>", body_style),
            Paragraph(m_desc, body_style),
            Paragraph(f"{20 + (idx * 5)}%", body_style)
        ])

    sched_table = Table(table_data, colWidths=[2.2 * inch, 4.3 * inch, 1.0 * inch])
    sched_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), light_bg),
        ('BOX', (0, 0), (-1, -1), 1, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, border_color),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(sched_table)

    elements.append(Spacer(1, 12))
    elements.append(Paragraph("3. Grading Policy & Assessment Breakdown", h2_style))

    grading_data = [
        [Paragraph("<b>Component</b>", body_style), Paragraph("<b>Percentage</b>", body_style), Paragraph("<b>Details</b>", body_style)],
        [Paragraph("Practical Exercises & Quizzes", body_style), Paragraph("30%", body_style), Paragraph("Weekly online quizzes & code exercises", body_style)],
        [Paragraph("Mid-Term Assessment", body_style), Paragraph("30%", body_style), Paragraph("Comprehensive theoretical & coding test", body_style)],
        [Paragraph("Final Capstone Project", body_style), Paragraph("40%", body_style), Paragraph("Individual end-to-end practical project", body_style)]
    ]
    g_table = Table(grading_data, colWidths=[2.5 * inch, 1.5 * inch, 3.5 * inch])
    g_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), light_bg),
        ('BOX', (0, 0), (-1, -1), 1, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, border_color),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(g_table)


def _build_reference_content(elements, title, code, modules_info, h2_style, h3_style, body_style, code_style, primary_color, border_color, light_bg):
    elements.append(Paragraph("1. Core Concepts & Theoretical Framework", h2_style))
    elements.append(Paragraph(
        f"This reference document provides quick access to core syntax, APIs, design principles, and best practices for <b>{title}</b>. "
        "Keep this sheet accessible as you work through lab exercises and projects.",
        body_style
    ))

    elements.append(Paragraph("Fundamental Rules & Design Conventions:", h3_style))
    rules = [
        "1. <b>Clean & Readable Code:</b> Prioritize clear variable naming, modular design, and concise function responsibilities.",
        "2. <b>Error Handling & Robustness:</b> Always validate inputs, handle edge cases, and catch runtime exceptions gracefully.",
        "3. <b>Efficiency & Complexity:</b> Pay attention to Time Complexity O(N) and Space Complexity constraints.",
        "4. <b>Documentation:</b> Maintain inline docstrings, type annotations, and README instructions."
    ]
    for r in rules:
        elements.append(Paragraph(r, body_style))

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("2. Quick Reference Syntax & Code Templates", h2_style))

    code_snippet_1 = """# Example 1: Standard Initialization & Workflow
def process_course_data(records: list) -> dict:
    results = {"total": len(records), "valid": 0, "processed": []}
    for record in records:
        if record.get("status") == "active":
            results["valid"] += 1
            results["processed"].append(record["id"])
    return results"""
    elements.append(Paragraph(code_snippet_1, code_style))

    code_snippet_2 = """// Example 2: Asynchronous Execution & API Handling
async function fetchCourseDetails(courseId) {
  try {
    const response = await fetch(`/api/courses/${courseId}`);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    return data.course;
  } catch (error) {
    console.error("Failed to load course details:", error);
    return null;
  }
}"""
    elements.append(Paragraph(code_snippet_2, code_style))

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("3. Recommended Reading & Official Documentation", h2_style))
    books = [
        "• <b>Official Documentation:</b> Official language specifications, API docs, and standard library guides.",
        "• <b>Recommended Textbook:</b> <i>Clean Code: A Handbook of Agile Software Craftsmanship</i>",
        "• <b>Design Patterns:</b> <i>Elements of Reusable Object-Oriented Software</i>",
        "• <b>Community Resources:</b> Developer Hubs, StackOverflow, and GitHub repositories."
    ]
    for b in books:
        elements.append(Paragraph(b, body_style))


def _build_exercises_content(elements, title, code, modules_info, h2_style, h3_style, body_style, code_style, primary_color, border_color, light_bg):
    elements.append(Paragraph("1. Hands-on Practice Exercises & Worksheets", h2_style))
    elements.append(Paragraph(
        f"Reinforce your understanding of <b>{title}</b> by working through these practical challenges. "
        "Attempt each exercise independently before checking the solution guidelines.",
        body_style
    ))

    elements.append(Spacer(1, 8))
    elements.append(Paragraph("Exercise 1: Basic Operations & Validation (Easy)", h3_style))
    elements.append(Paragraph(
        "<b>Problem Statement:</b> Write a function that takes a list of numbers and returns a dictionary containing the count, mean, minimum, and maximum values.",
        body_style
    ))
    elements.append(Paragraph(
        "<b>Input Example:</b> <code>[10, 20, 30, 40, 50]</code><br/>"
        "<b>Expected Output:</b> <code>{'count': 5, 'mean': 30.0, 'min': 10, 'max': 50}</code>",
        body_style
    ))

    elements.append(Spacer(1, 8))
    elements.append(Paragraph("Exercise 2: Data Transformation & Filtering (Medium)", h3_style))
    elements.append(Paragraph(
        "<b>Problem Statement:</b> Given a list of student dictionary records, filter out students with a score below 70 and group the remaining student names by course department.",
        body_style
    ))
    elements.append(Paragraph(
        "<b>Starter Template:</b>",
        body_style
    ))
    starter_code = """def group_top_students(students: list) -> dict:
    # TODO: Implement filtering and grouping logic
    grouped = {}
    for s in students:
        if s.get("score", 0) >= 70:
            dept = s.get("department", "General")
            grouped.setdefault(dept, []).append(s["name"])
    return grouped"""
    elements.append(Paragraph(starter_code, code_style))

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("Exercise 3: Advanced System Integration Challenge (Hard)", h3_style))
    elements.append(Paragraph(
        "<b>Problem Statement:</b> Design an in-memory caching system with key expiration (TTL) and LRU (Least Recently Used) eviction policy.",
        body_style
    ))

    elements.append(Spacer(1, 12))
    elements.append(Paragraph("2. Hints & Solutions Guide", h2_style))
    hints = [
        "• <b>Hint for Ex 1:</b> Use built-in functions <code>len()</code>, <code>sum()</code>, <code>min()</code>, and <code>max()</code>.",
        "• <b>Hint for Ex 2:</b> Use <code>dict.setdefault()</code> or <code>collections.defaultdict(list)</code> for clean grouping.",
        "• <b>Hint for Ex 3:</b> Combine a Hash Map for O(1) lookups with a Doubly Linked List for tracking usage order."
    ]
    for h in hints:
        elements.append(Paragraph(h, body_style))


def _generate_fallback_pdf(filepath, title, code, doc_type):
    """
    Fallback pure-Python binary PDF generator (guaranteed compliant PDF-1.4 format).
    Used if reportlab is absent. Dynamically calculates stream byte length and exact xref offsets.
    """
    content_lines = [
        f"{code} - {title}",
        f"Document Type: {doc_type.upper()}",
        "--------------------------------------------------",
        "Official Course Learning Material Document",
        "",
        "Course Overview & Highlights:",
        "1. Complete theoretical syllabus and week-by-week topic breakdown.",
        "2. Practical lab assignments, code exercises, and starter templates.",
        "3. Comprehensive cheat sheet and reference manual.",
        "",
        "For interactive materials and video lectures, please visit the online portal.",
        "Generated by E-Learning Management System Portal."
    ]
    
    # Simple PDF construction
    pdf_bytes = bytearray()
    
    pdf_bytes.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    
    offsets = []
    
    # 1 0 obj: Catalog
    offsets.append(len(pdf_bytes))
    pdf_bytes.extend(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    
    # 2 0 obj: Pages
    offsets.append(len(pdf_bytes))
    pdf_bytes.extend(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    
    # Stream content
    stream_content = "BT\n/F1 14 Tf\n50 720 Td\n18 TL\n"
    for line in content_lines:
        safe_line = line.replace("(", "\\(").replace(")", "\\)")
        stream_content += f"({safe_line}) '\n"
    stream_content += "ET\n"
    
    stream_encoded = stream_content.encode('latin1')
    stream_length = len(stream_encoded)
    
    # 3 0 obj: Page
    offsets.append(len(pdf_bytes))
    pdf_bytes.extend(b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n")
    
    # 4 0 obj: Stream
    offsets.append(len(pdf_bytes))
    pdf_bytes.extend(f"4 0 obj\n<< /Length {stream_length} >>\nstream\n".encode('latin1'))
    pdf_bytes.extend(stream_encoded)
    pdf_bytes.extend(b"\nendstream\nendobj\n")
    
    # 5 0 obj: Font
    offsets.append(len(pdf_bytes))
    pdf_bytes.extend(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    
    # xref table
    startxref = len(pdf_bytes)
    pdf_bytes.extend(f"xref\n0 6\n0000000000 65535 f \n".encode('latin1'))
    for off in offsets:
        pdf_bytes.extend(f"{off:010d} 00000 n \n".encode('latin1'))
        
    pdf_bytes.extend(f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{startxref}\n%%EOF\n".encode('latin1'))
    
    with open(filepath, 'wb') as f:
        f.write(pdf_bytes)
    return True
