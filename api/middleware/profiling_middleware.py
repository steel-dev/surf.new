import time
import asyncio
import psutil
import logging
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("profiling")


class ProfilingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time
        process = psutil.Process()
        mem_info = process.memory_info()
        tasks = len(asyncio.all_tasks())
        logger.info(
            f"\033[33mRequest: {request.url.path}, Duration: {duration:.3f}s, Memory Usage: {mem_info.rss/1024/1024:.2f} MB, Background tasks: {tasks}\033[0m")
        return response
