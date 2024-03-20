from phi.assistant.python import PythonAssistant
from phi.file.local.csv import CsvFile
from pydantic import BaseModel, Field

import sys
import json
import logging

import pandas as pd

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

class AssistantResponse(BaseModel):
    answer: str = Field(..., description="The result of the users question.")


def handler(event, context):
    event_body = json.loads(event.get("body", "{}"))

    stage = event_body.get("stage", "initial")

    answer = event_body.get("answer", "")

    file_path = event_body.get("file_path", "")

    question = event_body.get("question", "")

    df_head = pd.read_csv(file_path, nrows=5).to_string(index=False)

    python_assistant = PythonAssistant(
        files=[
            CsvFile(
                path=file_path,
                description="Contains information about a portfolio of stocks",
            )
        ],
        output_model=AssistantResponse,
        run_code=True,
        save_and_run=False,
        charting_libraries=["plotly"],
    )

    if stage == "initial":
        # Manager's prompt
        prompt = f"""
    
        You are a world class data scientist. You specialize in dataframe analytics.

        Your job is to tell your friend Kelly, the pandas expert, how to answer the customers question.

        Tell Kelly specifically how you want him to execute the analysis. Kelly is limited to Pandas and Numpy.

        Here is the customers question:

        {question}

        Here are the first 5 rows of the dataframe:
        {df_head}

        """        
    else:
        # Data analyst prompt
        prompt = f"""
    
        You are a world class python developer who specializes in pandas and numpy. 

        Your data scientist and friend Sean is going to give you instructions to answer the users question.

        Impress Steve and the customer with your abilities to follow instructions and provide the correct answer to the customer's question.

        Here are the first 5 rows of the file:
        {df_head}        
        
        Steve's instructions: 
        {answer}

        Customer question:
        {question}
        """

    answer: AssistantResponse = python_assistant.run(prompt)  # type: ignore

    # Logging the answer for visibility
    logging.info(
        f"Answer: {answer}, Type: {type(answer)}, Size: {sys.getsizeof(answer)}, ID: {id(answer)}"
    )

    # Convert the response object into a dictionary and then serialize it into a JSON string
    res = {}
    res['answer'] = answer.answer
    res['file_path'] = file_path
    res['question'] = question
    res['stage'] = 'followUp'
    response_json = json.dumps(res, ensure_ascii=False)

    return {
        "statusCode": 200,
        "body": response_json,  # Now `response_json` is a JSON-formatted string
        "headers": {"Content-Type": "application/json"},
    }
