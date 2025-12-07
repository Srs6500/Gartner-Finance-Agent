import json
import boto3
import os
import time
from botocore.exceptions import ClientError
from datetime import datetime

client = boto3.client('bedrock-agent-runtime')
dynamodb = boto3.resource('dynamodb')

AGENT_ID = os.environ['AGENT_ID']
AGENT_ALIAS_ID = os.environ['AGENT_ALIAS_ID']
TABLE_NAME = 'StockAgent-History'

def lambda_handler(event, context):
    print(f"Lambda invoked. Event: {json.dumps(event, default=str)}")

    try:
        body = json.loads(event.get('body', '{}'))
        action = body.get('action', 'send')  # Default to 'send' for backward compatibility

        # Handle different actions
        if action == 'send':
            return handle_send_message(body, context)
        elif action == 'load':
            return handle_load_conversation(body)
        elif action == 'list':
            return handle_list_conversations()
        elif action == 'delete':
            return handle_delete_conversation(body)
        elif action == 'rename':
            return handle_rename_conversation(body)
        else:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": f"Unknown action: {action}"})
            }

    except json.JSONDecodeError:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Invalid JSON in request"})
        }
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Internal server error"})
        }


def handle_send_message(body, context):
    """Handle sending a message and getting Bedrock response"""
    user_message = body.get('message', '').strip()
    session_id = body.get('sessionId', f"session-{context.aws_request_id}")

    if not user_message:
        return {
            "statusCode": 400,
            "isBase64Encoded": False,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Empty message"})
        }

    print(f"Invoking Bedrock Agent → Message: '{user_message}' | Session: {session_id}")

    try:
        response = client.invoke_agent(
            agentId=AGENT_ID,
            agentAliasId=AGENT_ALIAS_ID,
            sessionId=session_id,
            inputText=user_message,
            enableTrace=False
        )

        completion = ""
        stream_start = time.time()

        for event in response.get("completion", []):
            if time.time() - stream_start > 30:
                print("Stream timeout after 30s")
                break
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    try:
                        text = chunk['bytes'].decode('utf-8')
                        completion += text
                    except UnicodeDecodeError:
                        continue

        if not completion.strip():
            completion = "Agent returned no response. Try rephrasing your query."

        print(f"Stream complete. Response length: {len(completion)}")

        # Save message to DynamoDB
        try:
            save_message_to_db(session_id, user_message, completion.strip())
            print(f"Message saved successfully for session: {session_id}")
        except Exception as save_error:
            print(f"Failed to save message (non-critical): {str(save_error)}")
            # Continue even if save fails

        return {
            "statusCode": 200,
            "isBase64Encoded": False,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,x-api-key",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({
                "response": completion.strip(),
                "sessionId": session_id
            })
        }

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        print(f"Bedrock ClientError {error_code}: {error_msg}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Bedrock service error", "details": error_msg})
        }


def save_message_to_db(session_id, user_message, bot_response):
    """Save a message pair to DynamoDB"""
    try:
        table = dynamodb.Table(TABLE_NAME)
        timestamp = int(time.time() * 1000)  # Use milliseconds for better sorting
        
        print(f"Attempting to save message for session: {session_id}")
        print(f"User message length: {len(user_message)}, Bot response length: {len(bot_response)}")
        
        # Get existing conversation or create new
        response = table.get_item(Key={'sessionId': session_id})
        print(f"Get item response: {response}")
        
        if 'Item' in response:
            # Update existing conversation
            print(f"Updating existing conversation for session: {session_id}")
            messages = response['Item'].get('messages', [])
            print(f"Existing messages count: {len(messages)}")
            
            messages.append({
                'role': 'user',
                'content': user_message,
                'timestamp': timestamp
            })
            messages.append({
                'role': 'assistant',
                'content': bot_response,
                'timestamp': timestamp + 1
            })
            
            # Keep existing title or update if empty
            title = response['Item'].get('title')
            if not title or title == 'New Chat':
                title = user_message[:50] if len(user_message) > 0 else 'New Chat'
            
            table.update_item(
                Key={'sessionId': session_id},
                UpdateExpression='SET messages = :msg, lastMessage = :last, messageCount = :count, updatedAt = :updated, #title = :title',
                ExpressionAttributeNames={
                    '#title': 'title'  # 'title' is a reserved word in DynamoDB
                },
                ExpressionAttributeValues={
                    ':msg': messages,
                    ':last': bot_response[:100],
                    ':count': len(messages),
                    ':updated': timestamp,
                    ':title': title
                }
            )
            print(f"Updated conversation with {len(messages)} messages")
        else:
            # Create new conversation
            print(f"Creating new conversation for session: {session_id}")
            messages = [
                {'role': 'user', 'content': user_message, 'timestamp': timestamp},
                {'role': 'assistant', 'content': bot_response, 'timestamp': timestamp + 1}
            ]
            table.put_item(
                Item={
                    'sessionId': session_id,
                    'title': user_message[:50] if len(user_message) > 0 else 'New Chat',
                    'messages': messages,
                    'lastMessage': bot_response[:100],
                    'messageCount': 2,
                    'createdAt': timestamp,
                    'updatedAt': timestamp
                }
            )
            print(f"Created new conversation with {len(messages)} messages")
        
        print(f"✅ Chat history saved successfully → session {session_id}")
    except Exception as e:
        print(f"❌ Error saving to DynamoDB: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise  # Re-raise to see in CloudWatch


def handle_load_conversation(body):
    """Load a conversation by sessionId"""
    try:
        session_id = body.get('sessionId')
        print(f"Loading conversation for sessionId: {session_id}")
        
        if not session_id:
            print("❌ No sessionId provided")
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "sessionId required"})
            }

        table = dynamodb.Table(TABLE_NAME)
        print(f"Querying DynamoDB table: {TABLE_NAME}")
        response = table.get_item(Key={'sessionId': session_id})
        print(f"DynamoDB response: {response}")

        if 'Item' not in response:
            print(f"❌ No item found for sessionId: {session_id}")
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"messages": []})
            }

        item = response['Item']
        messages = item.get('messages', [])
        print(f"Found {len(messages)} messages in conversation")
        
        # Convert to frontend format
        formatted_messages = []
        for msg in messages:
            try:
                # Handle timestamp - could be int (milliseconds) or already a number
                ts = msg.get('timestamp', 0)
                if isinstance(ts, (int, float)):
                    # Convert milliseconds to ISO string
                    formatted_messages.append({
                        'role': msg.get('role', 'user'),
                        'content': msg.get('content', ''),
                        'timestamp': datetime.fromtimestamp(ts / 1000).isoformat()
                    })
                else:
                    # Already a string or other format
                    formatted_messages.append({
                        'role': msg.get('role', 'user'),
                        'content': msg.get('content', ''),
                        'timestamp': str(ts)
                    })
            except Exception as ts_error:
                print(f"Error formatting message timestamp: {ts_error}")
                formatted_messages.append({
                    'role': msg.get('role', 'user'),
                    'content': msg.get('content', ''),
                    'timestamp': datetime.now().isoformat()
                })

        print(f"✅ Returning {len(formatted_messages)} formatted messages")
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"messages": formatted_messages})
        }
    except Exception as e:
        print(f"❌ Error loading conversation: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }


def handle_list_conversations():
    """List all conversations"""
    try:
        table = dynamodb.Table(TABLE_NAME)
        
        # Scan table to get all conversations
        response = table.scan()
        conversations = []
        
        for item in response.get('Items', []):
            conversations.append({
                'sessionId': item.get('sessionId'),
                'title': item.get('title', 'New Chat'),
                'lastMessage': item.get('lastMessage', ''),
                'timestamp': item.get('updatedAt', item.get('createdAt', 0)),
                'messageCount': item.get('messageCount', 0)
            })
        
        # Sort by timestamp (newest first)
        conversations.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
        
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"conversations": conversations})
        }
    except Exception as e:
        print(f"Error listing conversations: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }


def handle_delete_conversation(body):
    """Delete a conversation by sessionId"""
    try:
        session_id = body.get('sessionId')
        if not session_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "sessionId required"})
            }

        table = dynamodb.Table(TABLE_NAME)
        table.delete_item(Key={'sessionId': session_id})

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"success": True})
        }
    except Exception as e:
        print(f"Error deleting conversation: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }


def handle_rename_conversation(body):
    """Rename a conversation"""
    try:
        session_id = body.get('sessionId')
        new_title = body.get('title', '').strip()
        
        if not session_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "sessionId required"})
            }
        
        if not new_title:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "title required"})
            }

        table = dynamodb.Table(TABLE_NAME)
        table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET title = :title',
            ExpressionAttributeValues={':title': new_title}
        )

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"success": True})
        }
    except Exception as e:
        print(f"Error renaming conversation: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }

