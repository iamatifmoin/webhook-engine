FROM python:3.12-alpine
WORKDIR /srv
COPY docker/echo-server/server.py /srv/server.py
EXPOSE 8888
CMD ["python", "-u", "/srv/server.py"]
