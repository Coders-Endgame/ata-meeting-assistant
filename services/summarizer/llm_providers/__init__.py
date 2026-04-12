from typing import Optional # optional allows for a parameter to be either a valur or None

# import required classes from the current directory of __init__.py
from .local_provider import LocalLLMProvider
from .remote_provider import RemoteLLMProvider
from .base_provider import BaseLLMProvider


# "mode" parameter will be passed from the _run_summarization() method
def get_provider(mode: str, model: Optional[str] = None) -> BaseLLMProvider:
    if mode == "remote":
        return RemoteLLMProvider(model)
    return LocalLLMProvider(model)  # default — preserves all existing behavior