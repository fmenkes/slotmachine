const Controller = require('../../lib/controller');
const meetingFacade = require('./facade');
const userFacade = require('../user/facade');
const courseFacade = require('../course/facade');
var Jenkinsapi = require('jenkins-api');
var jenkinsapi = Jenkinsapi.init(`http://${process.env.JENKINS_USERNAME}:${process.env.JENKINS_PASSWORD}@194.47.174.62:8080`);
const jenkins = require('jenkins')({ baseUrl: `http://${process.env.JENKINS_USERNAME}:${process.env.JENKINS_PASSWORD}@194.47.174.62:8080`, crumbIssuer: true, promisify: true });
const { getJob, createJenkinsConfigFile } = require('../../lib/helpers/repo');
const axios = require('axios');

class MeetingController extends Controller {

    async apiTest(req, res, next) {
        // Setting up jenkins job on webhook creation
        if (req.body.hook) {
            console.log("Setting up job on jenkins");
            try {
                const jenkinsConfigXML = await createJenkinsConfigFile({ scmUrl: "https://github.com/" + req.body.repository.full_name });

                await jenkins.job.create(req.body.repository.full_name.replace("/", "_"), jenkinsConfigXML);
            }
            catch (e) {
                console.log(e.message);
            }
        }
        // Starting buildjob on webhook release event
        else if (req.body.action === "published" && req.body.release.target_commitish === "master") {
            console.log("Starting buildjob");
            console.log("body:\n",req.body);
            try {
                await jenkins.job.build(req.body.repository.full_name.replace("/", "_"));
            }
            catch (e) {
                console.log(e.message);
            }

        }
        // Receives tests results data and sends a message to the student if they passed
        else if (req.body.url) {
            console.log(req.body.url);
            const jobObj = getJob(req.body.url);
            console.log(jobObj);
            // Get the test results from the jenkins server
            jenkinsapi.test_result(jobObj.org + "_" + jobObj.name, jobObj.number, async function(err, data) {
                if (err) { console.log(err) }
                if (data.failCount === 0) {
                    const user = await userFacade.findOne({ username: jobObj.name.split("-")[0] });
                    const course = await courseFacade.findOne({ title: jobObj.org });
                    course.users.push(user);
                    await course.save();
                    // SEND SOMETHING TO THE USER
                    // get user id from user name
                    const memberId = await getSlackUserId(jobObj.name.split("-")[0]);
                    // post message to user that they can book an exam
                    postMessageToSlackUser(memberId, course.channelid, "You tests have gone trough and you are now able to book an exam");
                } else {
                    const course = await courseFacade.findOne({ title: jobObj.org });
                    const memberId = await getSlackUserId(jobObj.name.split("-")[0]);
                    postMessageToSlackUser(memberId, course.channelid, `${data.failCount} tests failed, no cookie for you!`);
                }
            });
        }
    }
}

module.exports = new MeetingController(meetingFacade);

const getSlackUserId = async(username) => {
    try {
        const response = await axios({
            method: 'post',
            url: 'https://slack.com/api/users.list',
            headers: {
                Authorization: `Bearer ${process.env.SLACK_API_TOKEN}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        let memberId;
        for (let i = 0; i < response.data.members.length; i += 1) {
            // In production it should be reponse.data.members[i].name === username
            //if (response.data.members[i].name === username) {
            if (response.data.members[i].profile.display_name.toLowerCase() === username) {
                memberId = response.data.members[i].id;
                break;
            }
        }
        return memberId;
    }
    catch (e) {
        console.log(e.message);
    }


};

const postMessageToSlackUser = async(userid, channelid, message) => {

    console.log("channelid", channelid);
    console.log("userid", userid);
    try {
        await axios({
            method: 'post',
            url: 'https://slack.com/api/chat.postEphemeral',
            headers: {
                Authorization: `Bearer ${process.env.SLACK_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: { user: userid, text: message, channel: channelid }
        });
    }
    catch (e) { console.log(e.message); }
};
