from transformers import T5Tokenizer


def get_t5_tokenizer() -> T5Tokenizer:
    return T5Tokenizer.from_pretrained("TalkTix/text_generation_t5-ticket-creator")
