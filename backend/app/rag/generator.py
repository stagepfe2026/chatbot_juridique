from app.rag.pipeline import _get_llm


def generate(prompt_messages):
    # Génère la réponse finale à partir du prompt enrichi.
    return _get_llm().invoke(prompt_messages)
