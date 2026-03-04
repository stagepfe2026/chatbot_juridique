UPDATE_SUMMARY_PROMPT_FR = (
    "Tu maintiens un resume de conversation pour un chatbot juridique.\n"
    "Mets a jour le resume en utilisant le previous_summary et les recent_messages.\n"
    "Contraintes de sortie:\n"
    "- Resume court (max 10 lignes)\n"
    "- Conserver uniquement: objectifs, contraintes, decisions, termes importants, contexte utile\n"
    "- Couvrir explicitement les points traites recemment dans recent_messages (ne pas en omettre)\n"
    "- Si des notions definies ont ete donnees (ex: definition, regime, conditions), les conserver explicitement\n"
    "- Ne pas inclure de details inutiles\n"
    "- Ne pas inventer d'informations\n"
    "- Ne pas commencer par des formules comme: 'Voici le resume...' ou 'Resume mis a jour'\n"
    "- Sortie en texte simple uniquement (pas de JSON, pas de markdown)\n\n"
    "previous_summary:\n{previous_summary}\n\n"
    "coverage_hints:\n{coverage_hints}\n\n"
    "recent_messages:\n{recent_messages}\n"
)

FINAL_ANSWER_PROMPT_FR = (
    "Tu es un assistant juridique base sur RAG.\n"
    "Tu dois repondre UNIQUEMENT avec les informations presentes dans rag_context.\n"
    "Si l'information est absente, reponds exactement: \"Je ne trouve pas cette information dans les documents fournis.\"\n"
    "Quand l'information est disponible, donne une reponse concise et structuree en francais.\n"
    "Inclure les references de source (document, section/page quand disponible) dans la reponse.\n"
    "Ne pas inventer de faits.\n\n"
    "summary:\n{summary}\n\n"
    "last_messages:\n{last_messages}\n\n"
    "rag_context:\n{rag_context}\n\n"
    "user_question:\n{user_question}\n"
)

NO_INFO_ANSWER_FR = "Je ne trouve pas cette information dans les documents fournis."
