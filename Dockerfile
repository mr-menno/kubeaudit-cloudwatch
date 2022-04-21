FROM node:16-alpine
COPY src /kubeaudit-cloudwatch
WORKDIR /kubeaudit-cloudwatch
RUN yarn install
CMD ["node","server.js"]