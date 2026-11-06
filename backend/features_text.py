import re

import numpy as np
from nltk.sentiment import SentimentIntensityAnalyzer
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

TOKEN_PATTERN = re.compile(r"[a-zA-Z']+")
FIRST_PERSON = {"i", "me", "my", "mine", "myself"}
HANDCRAFTED_FEATURES = [
    "vader_compound",
    "first_person_ratio",
    "type_token_ratio",
    "word_count",
]


def tokenize(text):
    return TOKEN_PATTERN.findall(str(text).lower())


def linguistic_row(text, analyzer):
    tokens = tokenize(text)
    word_count = len(tokens)
    if word_count == 0:
        first_person_ratio = 0.0
        type_token_ratio = 0.0
    else:
        first_person_ratio = sum(token in FIRST_PERSON for token in tokens) / word_count
        type_token_ratio = len(set(tokens)) / word_count
    compound = analyzer.polarity_scores(str(text))["compound"]
    return [compound, first_person_ratio, type_token_ratio, float(word_count)]


def linguistic_matrix(texts, analyzer):
    rows = [linguistic_row(text, analyzer) for text in texts]
    return np.asarray(rows, dtype=np.float32)


def fit_tfidf(train_texts):
    vectorizer = TfidfVectorizer(
        max_features=3000,
        stop_words="english",
        lowercase=True,
        dtype=np.float32,
    )
    vectorizer.fit(train_texts)
    return vectorizer


def text_matrix(texts, analyzer, vectorizer):
    handcrafted = sparse.csr_matrix(linguistic_matrix(texts, analyzer))
    tfidf = vectorizer.transform(texts)
    return sparse.hstack([handcrafted, tfidf], format="csr")


def text_feature_names(vectorizer):
    tfidf_names = [f"tfidf_{term}" for term in vectorizer.get_feature_names_out()]
    return HANDCRAFTED_FEATURES + tfidf_names
