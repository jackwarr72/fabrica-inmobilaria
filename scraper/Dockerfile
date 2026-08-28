# Use official lightweight Python image
FROM python:3.13-slim

# Set working directory inside container
WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project files
COPY . .

# Expose the API port
EXPOSE 8000

# Command to run the FastAPI server by default
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
