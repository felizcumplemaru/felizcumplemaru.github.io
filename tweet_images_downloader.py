import json, requests, os

TWEETS_FILE = 'tweets.json'
IMAGES_DIR = 'img/tweets/'

formated_tweets = []

with open(TWEETS_FILE, 'r', encoding='utf-8') as file:
    tweets = json.load(file)
    for tweet in tweets:
        img_src = tweet.get('imgSrc')
        img_id = img_src.split('media/')[1].split('?')[0]

        tweet['newSrc'] = f'/img/tweets/{img_id}.jpg'
        tweet['imgId']  = img_id
        formated_tweets.append(tweet)

        if os.path.exists(IMAGES_DIR + f'{img_id}.jpg'):
            print(f'Image already exists: {img_id}.jpg')
            continue
        img_response = requests.get(img_src)
        if img_response.status_code == 200:
            with open(IMAGES_DIR + f'{img_id}.jpg', 'wb') as img_file:
                img_file.write(img_response.content)
            print(f'Downloaded: {img_id}.jpg')
        else:
            print(f'Failed to download image from {img_src}')

with open(TWEETS_FILE, 'w', encoding='utf-8') as file:
    json.dump(formated_tweets, file, ensure_ascii=False, indent=4)