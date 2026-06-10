import re
from ai.services.qwen import call_qwen

TECH_STACKS = [
    # Languages
    "python", "javascript", "typescript", "java", "c#", "c++", "go", "rust",
    "php", "ruby", "swift", "kotlin", "scala", "r", "matlab", "dart", "elixir",

    # Frontend
    "react", "next.js", "nextjs", "vue", "angular", "svelte", "nuxt", "remix",
    "tailwind", "bootstrap", "sass", "webpack", "vite", "html", "css",

    # Backend / Frameworks
    "node.js", "nodejs", "fastapi", "django", "flask", "express", "laravel",
    "spring boot", "rails", "gin", "fiber", "nestjs", "hapi", "koa",
    "sqlalchemy", "alembic", "celery", "pydantic",

    # Databases
    "postgresql", "mysql", "mongodb", "redis", "sqlite", "elasticsearch",
    "dynamodb", "cassandra", "neo4j", "supabase", "planetscale", "cockroachdb",
    "neon", "firebase", "firestore",

    # AI / LLM / ML
    "openai", "gpt-4", "gpt-3", "gpt4", "chatgpt",
    "anthropic", "claude",
    "gemini", "google ai", "google gemini",
    "qwen", "dashscope",
    "langchain", "langgraph", "langsmith",
    "crewai", "autogen", "llama-index", "llamaindex",
    "llama", "llama2", "llama3", "ollama",
    "huggingface", "hugging face", "transformers",
    "pytorch", "tensorflow", "keras", "scikit-learn", "sklearn",
    "pandas", "numpy", "scipy", "matplotlib", "seaborn",
    "mlflow", "wandb", "weights & biases",
    "rag", "vector database", "embeddings",
    "pinecone", "weaviate", "chromadb", "chroma", "qdrant", "milvus", "faiss",
    "machine learning", "deep learning", "nlp", "computer vision", "llm",
    "fine-tuning", "prompt engineering", "rlhf",

    # Cloud & DevOps
    "aws", "azure", "gcp", "google cloud",
    "docker", "kubernetes", "k8s", "terraform", "ansible", "helm",
    "github actions", "gitlab ci", "jenkins", "circleci", "travis ci",
    "vercel", "netlify", "render", "fly.io", "heroku", "digital ocean",
    "linux", "bash", "nginx", "apache",

    # Messaging / Streaming
    "kafka", "rabbitmq", "sqs", "pubsub", "mqtt", "websocket", "grpc",

    # APIs / Protocols
    "rest api", "graphql", "rest", "soap", "openapi", "swagger",

    # Tools / Other
    "git", "github", "gitlab", "bitbucket",
    "jira", "confluence", "postman", "figma",
    "stripe", "twilio", "sendgrid",
    "agile", "scrum", "kanban", "devops", "ci/cd",
]

# Deduplicate while preserving order
_seen = set()
TECH_STACKS = [x for x in TECH_STACKS if not (x in _seen or _seen.add(x))]


def extract_stacks_from_text(text: str) -> list[str]:
    text_lower = text.lower()
    found = [s for s in TECH_STACKS if re.search(r'\b' + re.escape(s) + r'\b', text_lower)]
    # Deduplicate preserving order
    seen: set[str] = set()
    unique = []
    for s in found:
        if s not in seen:
            seen.add(s)
            unique.append(s)
    return unique


async def analyze_jd(job_description: str) -> dict:
    detected_stacks = extract_stacks_from_text(job_description)

    prompt = f"""Analyze this job description and extract key information.

Job Description:
{job_description[:3000]}

Extract and return:
1. Top 5 required technical skills
2. Required years of experience
3. Key job responsibilities (3-5 points)
4. Seniority level (Junior/Mid/Senior/Lead)

Be concise and structured."""

    ai_analysis = await call_qwen(prompt, max_tokens=800, model="qwen-turbo")

    return {
        "detected_stacks": detected_stacks,
        "ai_analysis": ai_analysis,
        "raw_jd": job_description,
    }
