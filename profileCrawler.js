let data = [];
let tweet = null;
let tweets;
let tweetsArray;
let index = 0;
let currentTweet;
let currentTweetIndex;
let nextTweet;
let nextElement;

function isStartOfThread(tweet) {
    return tweet.children[0].children[0].children[1].children[0].children.length === 2;
}

function extractTweetData(tweet) {
    let textParts = tweet.querySelectorAll('span')[5].textContent.split(', ');
    return {
        imgSrc: tweet.querySelectorAll('img')[3].src,
        ciudad: textParts[0],
        departamento: textParts[1],
        provincia: textParts[2]
    };
}

do {
    do{
        tweets = document.querySelectorAll('article');
        tweetsArray = Array.from(tweets);
        if (tweet === null) {
            tweet = tweetsArray[0];
        }
        currentTweetIndex = tweetsArray.indexOf(tweet);
        nextIndex = currentTweetIndex + 1;
        if (nextIndex === tweetsArray.length) {
            await new Promise(r => setTimeout(r, 100));
        }
    }while(nextIndex === tweetsArray.length);
    tweet = tweetsArray[nextIndex];
    if (isStartOfThread(tweet)) {
        let extracted = false;
        do{
            try{
                data.push(extractTweetData(tweet));
                extracted = true;
            }catch(e){
                await new Promise(r => setTimeout(r, 100));
            }
        }while(!extracted);
    }
    console.log(data);
    tweet.scrollIntoView(false);
    await new Promise(r => setTimeout(r, 100));
}while(true);