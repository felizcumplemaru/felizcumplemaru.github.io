import json, requests, os, csv

TWEETS_FILE = 'tweets.json'
DATA_CSV = 'localidad_bahra.csv'
IMAGES_DIR = 'img/tweets/'

formated_tweets = []

bahra_data = {}
with open(DATA_CSV, 'r', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        nombre = f"{row['nombre_geografico']}, {row['nombre_departamento']}, {row['nombre_provincia']}"
        data = {
            'latitud_grado_decimal': float(row['latitud_grado_decimal']),
            'longitud_grado_decimal': float(row['longitud_grado_decimal'])
        }
        bahra_data[nombre] = data

with open(TWEETS_FILE, 'r', encoding='utf-8') as file:
    tweets = json.load(file)
    for tweet in tweets:
        img_src = tweet.get('imgSrc')
        img_id = img_src.split('media/')[1].split('?')[0]

        nombre_geografico = f"{tweet['ciudad']}, {tweet['departamento']}, {tweet['provincia']}"
        geodata = bahra_data.get(nombre_geografico)
        if not geodata:
            print(f'Geodata not found for: {nombre_geografico}')
            continue

        tweet['newSrc'] = f'/img/tweets/{img_id}.jpg'
        tweet['imgId']  = img_id
        tweet['lat'] = geodata['latitud_grado_decimal']
        tweet['lon'] = geodata['longitud_grado_decimal']
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