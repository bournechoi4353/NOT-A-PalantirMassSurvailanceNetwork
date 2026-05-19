FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    git curl less vim ripgrep ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash claude
USER claude
WORKDIR /workspace

RUN npm config set prefix '/home/claude/.npm-global' \
    && echo 'export PATH=/home/claude/.npm-global/bin:$PATH' >> /home/claude/.bashrc

ENV PATH=/home/claude/.npm-global/bin:$PATH

RUN npm install -g @anthropic-ai/claude-code

CMD ["claude", "--dangerously-skip-permissions"]
