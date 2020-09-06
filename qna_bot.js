const { ActivityHandler, MessageFactory } = require('botbuilder');
const {LuisRecognizer, QnAMaker}  = require('botbuilder-ai');

const CONVERSATION_DATA_PROPERTY = 'conversationData';
const USER_PROFILE_PROPERTY = 'userProfile';

class QnA_Bot extends ActivityHandler {
    constructor(conversationState, userState) {
        super();

        try {
            this.qnaMaker = new QnAMaker({
                knowledgeBaseId: process.env.QnAKnowledgebaseId,
                endpointKey: process.env.QnAEndpointKey,
                host: process.env.QnAEndpointHostName
            });
        } catch (err) {
            console.warn(`QnAMaker Exception: ${ err } Check your QnAMaker configuration in .env`);
        }   
    
        // Create the state property accessors for the conversation data and user profile.
        this.conversationDataAccessor = conversationState.createProperty(CONVERSATION_DATA_PROPERTY);
        this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);

        // The state management objects for the conversation and user state.
        this.conversationState = conversationState;
        this.userState = userState;

        this.onMessage(async (turnContext, next) => {
            // Get the state properties from the turn context.
            const userProfile = await this.userProfileAccessor.get(turnContext, {});
            const conversationData = await this.conversationDataAccessor.get(
                turnContext, { promptedForUserName: false });

            if (!userProfile.name) {
                // First time around this is undefined, so we will prompt user for name.
                if (conversationData.promptedForUserName) {
                    // Set the name to what the user provided.
                    userProfile.name = turnContext.activity.text;

                    // Acknowledge that we got their name.
                    await turnContext.sendActivity(`Hi ${ userProfile.name }. How may I help you?.`);
                    await this.sendSuggestedActions(turnContext);
                    // Reset the flag to allow the bot to go though the cycle again.
                    conversationData.promptedForUserName = false;
                } else {
                    // Prompt the user for their name.
                    await turnContext.sendActivity('What is your name?');

                    // Set the flag to true, so we don't prompt in the next turn.
                    conversationData.promptedForUserName = true;
                }
            } else {
                // Add message details to the conversation data.
                conversationData.timestamp = turnContext.activity.timestamp.toLocaleString();
                conversationData.channelId = turnContext.activity.channelId;

                // Display state data.
                
                //await turnContext.sendActivity(`${ userProfile.name } sent: ${ turnContext.activity.text }`);

                if (!process.env.QnAKnowledgebaseId || !process.env.QnAEndpointKey || !process.env.QnAEndpointHostName) {
                    const unconfiguredQnaMessage = 'NOTE: \r\n' +
                        'QnA Maker is not configured. To enable all capabilities, add `QnAKnowledgebaseId`, `QnAEndpointKey` and `QnAEndpointHostName` to the .env file. \r\n' +
                        'You may visit www.qnamaker.ai to create a QnA Maker knowledge base.';
    
                    await turnContext.sendActivity(unconfiguredQnaMessage);
                } else {
                    console.log('Calling QnA Maker');
    
                    const qnaResults = await this.qnaMaker.getAnswers(turnContext);
    
                    // If an answer was received from QnA Maker, send the answer back to the user.
                    if (qnaResults[0]) {
                        await turnContext.sendActivity(qnaResults[0].answer);
    
                    // If no answers were returned from QnA Maker, reply with help.
                    } else {
                        await turnContext.sendActivity('No QnA Maker answers were found.');
                    }
                }
                

            }

                

            // By calling next() you ensure that the next BotHandler is run.
            await next();

        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity('Welcome to NanBoya Sample Bot. Type anything to get started.');
                }

            }
            // By calling next() you ensure that the next BotHandler is run.

            
            await next();


        });
    }

    /**
     * Override the ActivityHandler.run() method to save state changes after the bot logic completes.
     */
    async run(context) {
        await super.run(context);

        // Save any state changes. The load happened during the execution of the Dialog.
        await this.conversationState.saveChanges(context, false);
        await this.userState.saveChanges(context, false);
    }

    async sendSuggestedActions(turnContext) {
        var reply = MessageFactory.suggestedActions(['who r u?','who created u?','買取時に必要なものは？']);
        await turnContext.sendActivity(reply);
    }
}


module.exports.QnA_Bot= QnA_Bot;
