import os
import unittest
from unittest.mock import patch

from api.models import ModelConfig, ModelProvider
from api.providers import create_llm


class MiniMaxProviderTests(unittest.TestCase):
    @patch("api.providers.ChatOpenAI")
    def test_openai_defaults_to_global_endpoint(self, chat_openai):
        config = ModelConfig(
            provider=ModelProvider.MINIMAX,
            model_name="MiniMax-M3",
            api_key="placeholder",
        )

        with patch.dict(os.environ, {}, clear=True):
            llm, use_vision = create_llm(config)

        self.assertIs(llm, chat_openai.return_value)
        self.assertTrue(use_vision)
        self.assertEqual(
            chat_openai.call_args.kwargs["base_url"],
            "https://api.minimax.io/v1",
        )

    @patch("api.providers.ChatAnthropic")
    def test_anthropic_accepts_sdk_base_url(self, chat_anthropic):
        config = ModelConfig(
            provider=ModelProvider.MINIMAX,
            model_name="MiniMax-M2.7",
            api_key="placeholder",
        )

        with patch.dict(
            os.environ,
            {
                "MINIMAX_API_FORMAT": "anthropic",
                "MINIMAX_BASE_URL": "https://api.minimaxi.com/anthropic/",
            },
            clear=True,
        ):
            llm, use_vision = create_llm(config)

        self.assertIs(llm, chat_anthropic.return_value)
        self.assertFalse(use_vision)
        self.assertEqual(
            chat_anthropic.call_args.kwargs["base_url"],
            "https://api.minimaxi.com/anthropic",
        )

    @patch("api.providers.ChatAnthropic")
    def test_anthropic_rejects_base_url_without_sdk_path(self, chat_anthropic):
        config = ModelConfig(
            provider=ModelProvider.MINIMAX,
            model_name="MiniMax-M3",
            api_key="placeholder",
        )

        with patch.dict(
            os.environ,
            {
                "MINIMAX_API_FORMAT": "anthropic",
                "MINIMAX_BASE_URL": "https://api.minimax.io/v1",
            },
            clear=True,
        ):
            with self.assertRaisesRegex(ValueError, "must end with '/anthropic'"):
                create_llm(config)

        chat_anthropic.assert_not_called()


if __name__ == "__main__":
    unittest.main()
