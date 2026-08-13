import sys
import os
import uuid
from bson import ObjectId

sys.path.append(os.path.abspath("d:/nishanthini/Dropout prediction/project/backend"))
from config.database import db

from utils.pdf_generator import generate_course_pdf

upload_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
os.makedirs(upload_dir, exist_ok=True)

def generate_pdf(filename, title, code, doc_type, modules_info=None):
    filepath = os.path.join(upload_dir, filename)
    generate_course_pdf(filepath, title, code, doc_type, modules_info)
    return f"/static/uploads/{filename}"


rich_courses = [
    {
        "code": "P-564",
        "title": "Python Programming Masterclass",
        "category": "Programming",
        "difficulty": "Beginner",
        "instructor": "Dr. Sarah Jenkins",
        "duration": "10 weeks (60 hours)",
        "language": "English",
        "capacity": 50,
        "is_active": True,
        "thumbnail": "/static/uploads/python_thumbnail.png",
        "description": "Comprehensive Python programming course covering syntax, control structures, functions, data structures, OOP principles, exception handling, and real-world scripting projects.",
        "prerequisites": "Basic computer literacy",
        "modules": [
            {
                "id": "PY-MOD-101",
                "title": "Module 1: Python Setup & Development Environment",
                "description": "Install Python 3, configure VS Code/Jupyter, and run your first Python script.",
                "lessons": [
                    {"id": "PY-L101", "title": "Installing Python & VS Code Setup", "type": "video", "duration": "12 min", "url": "https://www.youtube.com/watch?v=kqtD5dpn9C8"},
                    {"id": "PY-L102", "title": "Writing and Running Your First Python Script", "type": "video", "duration": "15 min", "url": "https://www.youtube.com/watch?v=rfscVS0vtbw"}
                ],
                "quizzes": [
                    {
                        "id": "PY-Q101",
                        "title": "Python Setup & Syntax Basics Quiz",
                        "description": "Test your basic understanding of Python interpreter and execution.",
                        "questions": [
                            {"question": "Which command checks the installed Python version in terminal?", "options": ["python --version", "py -check", "version python", "python -v"], "answer": "python --version"}
                        ]
                    }
                ]
            },
            {
                "id": "PY-MOD-102",
                "title": "Module 2: Variables, Data Types & Arithmetic Operators",
                "description": "Understand Python primitive data types, variable declarations, and arithmetic operations.",
                "lessons": [
                    {"id": "PY-L103", "title": "Variables, Strings, and Numbers", "type": "video", "duration": "18 min", "url": "https://www.youtube.com/watch?v=khKv-8q7YmY"}
                ],
                "quizzes": [
                    {
                        "id": "PY-Q102",
                        "title": "Variables & Data Types Quiz",
                        "description": "Test knowledge of type casting and primitive types.",
                        "questions": [
                            {"question": "What is the data type of 3.14 in Python?", "options": ["int", "float", "str", "double"], "answer": "float"}
                        ]
                    }
                ]
            },
            {
                "id": "PY-MOD-103",
                "title": "Module 3: Control Flow, Conditional Logic & Loops",
                "description": "Master if-else conditions, while loops, and for loop iterations over ranges.",
                "lessons": [
                    {"id": "PY-L104", "title": "If Statements & Logical Operators", "type": "video", "duration": "20 min", "url": "https://www.youtube.com/watch?v=PqFKRqpHrjw"},
                    {"id": "PY-L105", "title": "For Loops and Iteration in Python", "type": "video", "duration": "22 min", "url": "https://www.youtube.com/watch?v=9LgyKiq_hU0"}
                ],
                "quizzes": [
                    {
                        "id": "PY-Q103",
                        "title": "Control Flow & Loops Quiz",
                        "description": "Evaluate loop conditions and execution order.",
                        "questions": [
                            {"question": "Which keyword is used to exit a loop early?", "options": ["stop", "exit", "break", "continue"], "answer": "break"}
                        ]
                    }
                ]
            },
            {
                "id": "PY-MOD-104",
                "title": "Module 4: Functions, Arguments & Scope",
                "description": "Learn to write reusable modular code using def functions, parameters, and return statements.",
                "lessons": [
                    {"id": "PY-L106", "title": "Defining Functions & Returning Values", "type": "video", "duration": "25 min", "url": "https://www.youtube.com/watch?v=NSbOtYzIQI0"}
                ],
                "quizzes": [
                    {
                        "id": "PY-Q104",
                        "title": "Functions & Modular Code Quiz",
                        "description": "Test understanding of function parameters and return types.",
                        "questions": [
                            {"question": "Which keyword defines a function in Python?", "options": ["function", "def", "func", "define"], "answer": "def"}
                        ]
                    }
                ]
            },
            {
                "id": "PY-MOD-105",
                "title": "Module 5: Data Structures (Lists, Tuples, Dictionaries & Sets)",
                "description": "Store and manipulate complex data using lists, dictionaries, tuples, and sets.",
                "lessons": [
                    {"id": "PY-L107", "title": "Lists and List Methods", "type": "video", "duration": "24 min", "url": "https://www.youtube.com/watch?v=W8KRzm-HUcc"},
                    {"id": "PY-L108", "title": "Dictionaries and Key-Value Operations", "type": "video", "duration": "22 min", "url": "https://www.youtube.com/watch?v=daefaLgNkw0"}
                ],
                "quizzes": [
                    {
                        "id": "PY-Q105",
                        "title": "Data Structures Quiz",
                        "description": "Check knowledge of list slicing and dictionary lookups.",
                        "questions": [
                            {"question": "Which Python structure is immutable?", "options": ["List", "Dictionary", "Tuple", "Set"], "answer": "Tuple"}
                        ]
                    }
                ]
            },
            {
                "id": "PY-MOD-106",
                "title": "Module 6: Object-Oriented Programming (OOP) Principles",
                "description": "Understand classes, objects, constructors (__init__), inheritance, and encapsulation.",
                "lessons": [
                    {"id": "PY-L109", "title": "Classes, Objects, and Self Keyword", "type": "video", "duration": "30 min", "url": "https://www.youtube.com/watch?v=JeznW_7DlB0"}
                ],
                "quizzes": [
                    {
                        "id": "PY-Q106",
                        "title": "Object-Oriented Programming Quiz",
                        "description": "Evaluate OOP concepts in Python.",
                        "questions": [
                            {"question": "What is the initializer method name in a Python class?", "options": ["__start__", "__init__", "constructor", "create"], "answer": "__init__"}
                        ]
                    }
                ]
            },
            {
                "id": "PY-MOD-107",
                "title": "Module 7: Exception Handling & File I/O",
                "description": "Handle runtime errors gracefully using try-except blocks and read/write text files.",
                "lessons": [
                    {"id": "PY-L110", "title": "Try-Except Blocks & Custom Exceptions", "type": "video", "duration": "22 min", "url": "https://www.youtube.com/watch?v=NIWwJbo-9_8"}
                ],
                "quizzes": [
                    {
                        "id": "PY-Q107",
                        "title": "Exception Handling Quiz",
                        "description": "Test exception trapping and file opening logic.",
                        "questions": [
                            {"question": "Which block executes regardless of whether an exception occurred?", "options": ["except", "finally", "catch", "else"], "answer": "finally"}
                        ]
                    }
                ]
            }
        ]
    },
    {
        "code": "C-346",
        "title": "C Programming Fundamentals & Data Structures",
        "category": "Programming",
        "difficulty": "Intermediate",
        "instructor": "Prof. David Miller",
        "duration": "8 weeks (50 hours)",
        "language": "English",
        "capacity": 40,
        "is_active": True,
        "thumbnail": "/static/uploads/c_programming_thumbnail.png",
        "description": "Foundational course in procedural programming with C covering pointers, memory management, file handling, and core data structures.",
        "prerequisites": "Basic programming concepts",
        "modules": [
            {
                "id": "C-MOD-101",
                "title": "Module 1: Introduction to C & GCC Compiler",
                "description": "Set up GCC compiler, understand C compilation pipeline, and write main() function.",
                "lessons": [{"id": "C-L101", "title": "Installing GCC & Writing Main Function", "type": "video", "duration": "15 min", "url": "https://www.youtube.com/watch?v=KJgsSFOSQv0"}],
                "quizzes": [{"id": "C-Q101", "title": "C Basics Quiz", "description": "C syntax & main function rules.", "questions": [{"question": "What is the return type of the main function in standard C?", "options": ["void", "int", "float", "char"], "answer": "int"}]}]
            },
            {
                "id": "C-MOD-102",
                "title": "Module 2: Variables, Primitive Types & Input/Output",
                "description": "Learn printf, scanf, format specifiers, and variable memory sizing.",
                "lessons": [{"id": "C-L102", "title": "Format Specifiers and Scanf Operations", "type": "video", "duration": "18 min", "url": "https://www.youtube.com/watch?v=vLnPwxZdW4Y"}],
                "quizzes": [{"id": "C-Q102", "title": "Input/Output Quiz", "description": "Check format specifier knowledge.", "questions": [{"question": "Which format specifier is used for printing integers in C?", "options": ["%f", "%d", "%s", "%c"], "answer": "%d"}]}]
            },
            {
                "id": "C-MOD-103",
                "title": "Module 3: Control Flow & Iterative Statements",
                "description": "Master switch-case, while loops, for loops, and nested branching.",
                "lessons": [{"id": "C-L103", "title": "Switch Statements and Loop Optimization", "type": "video", "duration": "20 min", "url": "https://www.youtube.com/watch?v=r32W-uFqQ6E"}],
                "quizzes": [{"id": "C-Q103", "title": "Control Structures Quiz", "description": "Evaluate loop and switch logic.", "questions": [{"question": "Which statement exits a switch block?", "options": ["stop", "break", "return", "exit"], "answer": "break"}]}]
            },
            {
                "id": "C-MOD-104",
                "title": "Module 4: Functions & Call by Value vs Reference",
                "description": "Function prototypes, parameter passing, and recursive algorithms.",
                "lessons": [{"id": "C-L104", "title": "Function Prototypes & Memory Stack", "type": "video", "duration": "22 min", "url": "https://www.youtube.com/watch?v=48SSeS-5wS8"}],
                "quizzes": [{"id": "C-Q104", "title": "Functions & Scope Quiz", "description": "Check knowledge of call stack and functions.", "questions": [{"question": "What is required before calling a function defined below main()?", "options": ["Function declaration/prototype", "Include math.h", "Pointers", "Global variables"], "answer": "Function declaration/prototype"}]}]
            },
            {
                "id": "C-MOD-105",
                "title": "Module 5: Arrays, Strings & Character Buffers",
                "description": "Multi-dimensional arrays, null-terminated strings, and string.h library functions.",
                "lessons": [{"id": "C-L105", "title": "Arrays and String Manipulation in C", "type": "video", "duration": "24 min", "url": "https://www.youtube.com/watch?v=1uR4tL-ZUGM"}],
                "quizzes": [{"id": "C-Q105", "title": "Arrays & Strings Quiz", "description": "Check null terminator character knowledge.", "questions": [{"question": "Which character marks the end of a string in C?", "options": ["\\n", "\\0", "\\t", "EOF"], "answer": "\\0"}]}]
            },
            {
                "id": "C-MOD-106",
                "title": "Module 6: Pointers & Dynamic Memory Allocation",
                "description": "Understand memory addresses, dereferencing, malloc, calloc, realloc, and free.",
                "lessons": [{"id": "C-L106", "title": "Pointers, Addresses, and Malloc/Free", "type": "video", "duration": "28 min", "url": "https://www.youtube.com/watch?v=zuegQmMdy8M"}],
                "quizzes": [{"id": "C-Q106", "title": "Pointers & Memory Quiz", "description": "Check pointer dereference and memory allocation.", "questions": [{"question": "Which function deallocates dynamically allocated memory?", "options": ["delete", "remove", "free", "clear"], "answer": "free"}]}]
            }
        ]
    },
    {
        "code": "DS-973",
        "title": "Data Science & Machine Learning Essentials",
        "category": "Data Science",
        "difficulty": "Advanced",
        "instructor": "Dr. Alex Rivera",
        "duration": "12 weeks (80 hours)",
        "language": "English",
        "capacity": 60,
        "is_active": True,
        "thumbnail": "/static/uploads/datascience_thumbnail.png",
        "description": "End-to-end data science curriculum from data wrangling with Pandas/NumPy to statistical modeling, machine learning, and model evaluation.",
        "prerequisites": "Python basics and linear algebra",
        "modules": [
            {
                "id": "DS-MOD-101",
                "title": "Module 1: Data Science Foundations & NumPy Vectorization",
                "description": "Introduction to data pipelines, NumPy arrays, vector operations, and matrix math.",
                "lessons": [{"id": "DS-L101", "title": "NumPy Array Operations & Vectorization", "type": "video", "duration": "20 min", "url": "https://www.youtube.com/watch?v=QUT1VHiLmmI"}],
                "quizzes": [{"id": "DS-Q101", "title": "NumPy Quiz", "description": "NumPy array slicing and shape manipulation.", "questions": [{"question": "Which NumPy method changes array dimensions without altering data?", "options": ["reshape()", "convert()", "resize()", "reindex()"], "answer": "reshape()"}]}]
            },
            {
                "id": "DS-MOD-102",
                "title": "Module 2: Data Cleaning & Preprocessing with Pandas",
                "description": "DataFrame manipulation, handling missing values, encoding categorical variables, and merging.",
                "lessons": [{"id": "DS-L102", "title": "Pandas DataFrames, GroupBy & Missing Data", "type": "video", "duration": "25 min", "url": "https://www.youtube.com/watch?v=vmEHCJofslg"}],
                "quizzes": [{"id": "DS-Q102", "title": "Pandas Quiz", "description": "Check pandas filtering and aggregation.", "questions": [{"question": "Which Pandas method removes rows containing missing values?", "options": ["dropna()", "fillna()", "remove_null()", "clean()"], "answer": "dropna()"}]}]
            },
            {
                "id": "DS-MOD-103",
                "title": "Module 3: Exploratory Data Analysis & Visualization",
                "description": "Create publication-quality plots using Matplotlib and Seaborn.",
                "lessons": [{"id": "DS-L103", "title": "Seaborn Visualizations & Heatmaps", "type": "video", "duration": "22 min", "url": "https://www.youtube.com/watch?v=6GUZXDef2U0"}],
                "quizzes": [{"id": "DS-Q103", "title": "EDA & Visualization Quiz", "description": "Check chart selection and correlation plots.", "questions": [{"question": "Which plot is ideal for viewing feature correlation matrices?", "options": ["Scatter plot", "Heatmap", "Line chart", "Pie chart"], "answer": "Heatmap"}]}]
            },
            {
                "id": "DS-MOD-104",
                "title": "Module 4: Descriptive Statistics & Hypothesis Testing",
                "description": "Mean, median, variance, standard deviation, t-tests, and p-value interpretation.",
                "lessons": [{"id": "DS-L104", "title": "Statistical Testing & P-Values", "type": "video", "duration": "24 min", "url": "https://www.youtube.com/watch?v=0Pd3dc1GcHc"}],
                "quizzes": [{"id": "DS-Q104", "title": "Statistics Quiz", "description": "Evaluate p-value and confidence intervals.", "questions": [{"question": "What does a p-value less than 0.05 typically indicate?", "options": ["Statistically significant result rejecting null hypothesis", "Inconclusive data", "Accept null hypothesis", "Model error"], "answer": "Statistically significant result rejecting null hypothesis"}]}]
            },
            {
                "id": "DS-MOD-105",
                "title": "Module 5: Supervised Learning & Regression Models",
                "description": "Linear regression, multiple regression, gradient descent, and loss metrics (MSE, R2).",
                "lessons": [{"id": "DS-L105", "title": "Linear Regression and Gradient Descent", "type": "video", "duration": "28 min", "url": "https://www.youtube.com/watch?v=nk2CQITm_eo"}],
                "quizzes": [{"id": "DS-Q105", "title": "Regression Quiz", "description": "Check MSE and R-squared concepts.", "questions": [{"question": "What metric measures the proportion of variance explained by a regression model?", "options": ["R-squared (R2)", "MSE", "MAE", "RMSE"], "answer": "R-squared (R2)"}]}]
            },
            {
                "id": "DS-MOD-106",
                "title": "Module 6: Classification Algorithms & Decision Trees",
                "description": "Logistic regression, Decision Trees, Random Forests, and SVMs.",
                "lessons": [{"id": "DS-L106", "title": "Logistic Regression & Decision Tree Classifiers", "type": "video", "duration": "30 min", "url": "https://www.youtube.com/watch?v=zM4VZR0px8E"}],
                "quizzes": [{"id": "DS-Q106", "title": "Classification Quiz", "description": "Check precision, recall, and ROC curves.", "questions": [{"question": "Which metric measures true positives divided by total predicted positives?", "options": ["Recall", "Precision", "Accuracy", "F1-Score"], "answer": "Precision"}]}]
            }
        ]
    },
    {
        "code": "JV-949",
        "title": "Java Enterprise Software Engineering",
        "category": "Programming",
        "difficulty": "Intermediate",
        "instructor": "Prof. Michael Chang",
        "duration": "10 weeks (70 hours)",
        "language": "English",
        "capacity": 45,
        "is_active": True,
        "thumbnail": "/static/uploads/java_thumbnail.png",
        "description": "Complete Java enterprise development course covering object-oriented architecture, collections, exception handling, multithreading, and Spring Boot framework essentials.",
        "prerequisites": "Basic object-oriented programming concepts",
        "modules": [
            {
                "id": "JV-MOD-101",
                "title": "Module 1: Java JDK Setup & JVM Architecture",
                "description": "Understand JDK, JRE, JVM bytecode execution, and environment configuration.",
                "lessons": [{"id": "JV-L101", "title": "Java Environment Setup & JVM Basics", "type": "video", "duration": "16 min", "url": "https://www.youtube.com/watch?v=eIrMbAQSU34"}],
                "quizzes": [{"id": "JV-Q101", "title": "Java Setup Quiz", "description": "Check JVM and JDK understanding.", "questions": [{"question": "What compiles Java source code into bytecode?", "options": ["JVM", "Javac compiler", "JRE", "JRE Launcher"], "answer": "Javac compiler"}]}]
            },
            {
                "id": "JV-MOD-102",
                "title": "Module 2: Java Syntax, Variables & Flow Control",
                "description": "Primitive types, wrapper classes, loops, and conditional statements.",
                "lessons": [{"id": "JV-L102", "title": "Control Structures and Type Casting", "type": "video", "duration": "18 min", "url": "https://www.youtube.com/watch?v=RRubcjpTkks"}],
                "quizzes": [{"id": "JV-Q102", "title": "Syntax & Control Quiz", "description": "Evaluate Java primitive types.", "questions": [{"question": "Which data type stores true/false values in Java?", "options": ["bool", "boolean", "BooleanVal", "bit"], "answer": "boolean"}]}]
            },
            {
                "id": "JV-MOD-103",
                "title": "Module 3: Object-Oriented Principles in Java",
                "description": "Encapsulation, constructors, inheritance (extends), and method overloading/overriding.",
                "lessons": [{"id": "JV-L103", "title": "Classes, Inheritance & Polymorphism", "type": "video", "duration": "25 min", "url": "https://www.youtube.com/watch?v=ZVLk_J0z6hM"}],
                "quizzes": [{"id": "JV-Q103", "title": "OOP Quiz", "description": "Evaluate extends and implements keywords.", "questions": [{"question": "Which keyword is used for class inheritance in Java?", "options": ["implements", "extends", "inherits", "super"], "answer": "extends"}]}]
            },
            {
                "id": "JV-MOD-104",
                "title": "Module 4: Interfaces & Abstract Classes",
                "description": "Design decoupled architectures using interfaces, default methods, and abstract classes.",
                "lessons": [{"id": "JV-L104", "title": "Abstract Classes vs Interfaces", "type": "video", "duration": "22 min", "url": "https://www.youtube.com/watch?v=HvPlEJ3LHgE"}],
                "quizzes": [{"id": "JV-Q104", "title": "Interfaces Quiz", "description": "Check abstract class vs interface rules.", "questions": [{"question": "Can a class implement multiple interfaces in Java?", "options": ["Yes", "No", "Only up to 2", "Only with Spring"], "answer": "Yes"}]}]
            },
            {
                "id": "JV-MOD-105",
                "title": "Module 5: Java Collections Framework & Generics",
                "description": "ArrayList, LinkedList, HashMap, HashSet, and type-safe generics.",
                "lessons": [{"id": "JV-L105", "title": "ArrayList, HashMap, and Generics", "type": "video", "duration": "26 min", "url": "https://www.youtube.com/watch?v=viTHc_4XnCA"}],
                "quizzes": [{"id": "JV-Q105", "title": "Collections Quiz", "description": "Evaluate HashMap and List behavior.", "questions": [{"question": "Which Collection implementation stores key-value pairs?", "options": ["ArrayList", "HashSet", "HashMap", "Vector"], "answer": "HashMap"}]}]
            },
            {
                "id": "JV-MOD-106",
                "title": "Module 6: Exception Handling & File I/O Streams",
                "description": "Try-catch-finally, checked vs unchecked exceptions, and File Readers/Writers.",
                "lessons": [{"id": "JV-L106", "title": "Checked Exceptions and File Handling", "type": "video", "duration": "24 min", "url": "https://www.youtube.com/watch?v=K3wxx8-H8Jg"}],
                "quizzes": [{"id": "JV-Q106", "title": "Exception Handling Quiz", "description": "Check checked exceptions knowledge.", "questions": [{"question": "Which parent class do all Java exceptions inherit from?", "options": ["Throwable", "Exception", "Error", "Object"], "answer": "Throwable"}]}]
            }
        ]
    },
    {
        "code": "WEB-782",
        "title": "Web Development & Full-Stack Architecture",
        "category": "Design",
        "difficulty": "Beginner",
        "instructor": "Emily Watson",
        "duration": "12 weeks (75 hours)",
        "language": "English",
        "capacity": 55,
        "is_active": True,
        "thumbnail": "/static/uploads/webdev_thumbnail.png",
        "description": "Modern full-stack web development course covering HTML5, CSS3, JavaScript ES6+, React, Node.js, Express, and MongoDB REST APIs.",
        "prerequisites": "None",
        "modules": [
            {
                "id": "WEB-MOD-101",
                "title": "Module 1: HTML5 & Semantic Web Design",
                "description": "Learn HTML5 elements, semantic markup, forms, inputs, and accessibility.",
                "lessons": [{"id": "WEB-L101", "title": "HTML5 Elements & Forms", "type": "video", "duration": "15 min", "url": "https://www.youtube.com/watch?v=UB1O30fR-EE"}],
                "quizzes": [{"id": "WEB-Q101", "title": "HTML5 Quiz", "description": "Check HTML elements knowledge.", "questions": [{"question": "Which HTML tag is used for the largest heading?", "options": ["<h6>", "<h1>", "<head>", "<heading>"], "answer": "<h1>"}]}]
            },
            {
                "id": "WEB-MOD-102",
                "title": "Module 2: Responsive CSS3, Flexbox & Grid",
                "description": "Master box model, CSS Flexbox, Grid layouts, and responsive media queries.",
                "lessons": [{"id": "WEB-L102", "title": "Flexbox and CSS Grid Mastery", "type": "video", "duration": "22 min", "url": "https://www.youtube.com/watch?v=3YW65K6LcIA"}],
                "quizzes": [{"id": "WEB-Q102", "title": "CSS3 Layout Quiz", "description": "Check Flexbox axis properties.", "questions": [{"question": "Which CSS property defines the main axis direction in Flexbox?", "options": ["flex-direction", "justify-content", "align-items", "flex-wrap"], "answer": "flex-direction"}]}]
            },
            {
                "id": "WEB-MOD-103",
                "title": "Module 3: JavaScript ES6+ & DOM Manipulation",
                "description": "Arrow functions, destructuring, querySelector, event listeners, and DOM updates.",
                "lessons": [{"id": "WEB-L103", "title": "DOM Events and Modern JS", "type": "video", "duration": "25 min", "url": "https://www.youtube.com/watch?v=hdI2bqOjy3c"}],
                "quizzes": [{"id": "WEB-Q103", "title": "JavaScript DOM Quiz", "description": "Check event listeners and query selectors.", "questions": [{"question": "Which method attaches an event handler to an HTML element?", "options": ["addEventListener()", "attachEvent()", "onEvent()", "listen()"], "answer": "addEventListener()"}]}]
            },
            {
                "id": "WEB-MOD-104",
                "title": "Module 4: Asynchronous JavaScript, Fetch API & Promises",
                "description": "Learn async/await, Promises, JSON parsing, and HTTP requests using Fetch API / Axios.",
                "lessons": [{"id": "WEB-L104", "title": "Async/Await and Fetching REST APIs", "type": "video", "duration": "26 min", "url": "https://www.youtube.com/watch?v=cuEtnrL9-H0"}],
                "quizzes": [{"id": "WEB-Q104", "title": "Async JS Quiz", "description": "Check async/await syntax.", "questions": [{"question": "What does a fetch() call return in JavaScript?", "options": ["A Promise", "A String", "JSON data directly", "An Array"], "answer": "A Promise"}]}]
            },
            {
                "id": "WEB-MOD-105",
                "title": "Module 5: React Framework & State Management",
                "description": "Components, JSX syntax, useState, useEffect, and component props.",
                "lessons": [{"id": "WEB-L105", "title": "React Components, Props & Hooks", "type": "video", "duration": "30 min", "url": "https://www.youtube.com/watch?v=w7ejDZ8SWv8"}],
                "quizzes": [{"id": "WEB-Q105", "title": "React Basics Quiz", "description": "Evaluate React hooks and state.", "questions": [{"question": "Which Hook is used to manage local component state in React?", "options": ["useState", "useEffect", "useContext", "useMemo"], "answer": "useState"}]}]
            },
            {
                "id": "WEB-MOD-106",
                "title": "Module 6: Backend Node.js & Express REST APIs",
                "description": "Build Express routers, HTTP controllers, middleware, and CORS configuration.",
                "lessons": [{"id": "WEB-L106", "title": "Building Express REST Endpoints", "type": "video", "duration": "28 min", "url": "https://www.youtube.com/watch?v=l8WPWK9mS5M"}],
                "quizzes": [{"id": "WEB-Q106", "title": "Express Backend Quiz", "description": "Check Express route handlers.", "questions": [{"question": "Which Express method registers a GET endpoint handler?", "options": ["app.get()", "app.fetch()", "app.route()", "app.post()"], "answer": "app.get()"}]}]
            }
        ]
    }
]

def seed_courses():
    print("=== SEEDING DYNAMIC MULTI-MODULE COURSES (> 5 MODULES EACH) ===")
    courses_col = db.get_db()['courses']

    # 0. Generate default fallback sample PDFs
    generate_pdf("sample_syllabus.pdf", "General Course Syllabus", "GEN-101", "syllabus")
    generate_pdf("sample_reference.pdf", "General Reference Materials", "GEN-101", "reference")
    generate_pdf("sample_exercises.pdf", "General Practice Exercises", "GEN-101", "exercises")

    for cdata in rich_courses:
        code = cdata['code']
        title = cdata['title']
        modules = cdata.get('modules', [])

        # 1. Generate PDFs dynamically
        syllabus_file = f"{code}_Syllabus.pdf"
        reference_file = f"{code}_Reference_Materials.pdf"
        exercises_file = f"{code}_Practice_Exercises.pdf"

        syllabus_url = generate_pdf(syllabus_file, title, code, "syllabus", modules)
        reference_url = generate_pdf(reference_file, title, code, "reference", modules)
        exercises_url = generate_pdf(exercises_file, title, code, "exercises", modules)

        cdata['syllabus_pdf'] = syllabus_url
        cdata['reference_materials_pdf'] = reference_url
        cdata['practice_exercises_pdf'] = exercises_url
        cdata['studyMaterials'] = [
            {'id': 'syllabus', 'title': 'Course Syllabus PDF', 'type': 'pdf', 'url': syllabus_url},
            {'id': 'reference', 'title': 'Reference Materials PDF', 'type': 'pdf', 'url': reference_url},
            {'id': 'exercises', 'title': 'Practice Exercises PDF', 'type': 'pdf', 'url': exercises_url}
        ]

        # 2. Update or insert course document
        existing = courses_col.find_one({'code': code})
        if existing:
            cdata['_id'] = existing['_id']
            courses_col.replace_one({'code': code}, cdata)
            print(f"Updated course '{title}' ({code}) with {len(cdata['modules'])} modules and PDFs.")
        else:
            res = courses_col.insert_one(cdata)
            print(f"Created course '{title}' ({code}) with ID {res.inserted_id} and {len(cdata['modules'])} modules.")

    print("\nSuccessfully seeded all multi-module courses with PDF resources!")


if __name__ == '__main__':
    seed_courses()
