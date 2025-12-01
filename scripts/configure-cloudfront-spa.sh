#!/bin/bash
# Настраивает CloudFront для корректной работы SPA (React Router)
# Добавляет Custom Error Responses для 403/404 → index.html
#
# Требования: aws cli, jq
# Использование: ./scripts/configure-cloudfront-spa.sh

set -e

DISTRIBUTION_ID="E1XMCD5KKVBOBU"

echo "🔧 Настройка CloudFront Distribution: $DISTRIBUTION_ID"

# Проверка зависимостей
if ! command -v jq &> /dev/null; then
    echo "❌ Требуется jq. Установите: brew install jq"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ Требуется AWS CLI. Установите: brew install awscli"
    exit 1
fi

# Получаем текущую конфигурацию
echo "📥 Получение текущей конфигурации..."
RESPONSE=$(aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID")

ETAG=$(echo "$RESPONSE" | jq -r '.ETag')
CONFIG=$(echo "$RESPONSE" | jq '.DistributionConfig')

echo "   ETag: $ETAG"

# Добавляем Custom Error Responses
echo "📝 Добавление Custom Error Responses..."
UPDATED_CONFIG=$(echo "$CONFIG" | jq '.CustomErrorResponses = {
    "Quantity": 2,
    "Items": [
        {
            "ErrorCode": 403,
            "ResponsePagePath": "/index.html",
            "ResponseCode": "200",
            "ErrorCachingMinTTL": 10
        },
        {
            "ErrorCode": 404,
            "ResponsePagePath": "/index.html",
            "ResponseCode": "200",
            "ErrorCachingMinTTL": 10
        }
    ]
}')

# Сохраняем во временный файл
TEMP_FILE=$(mktemp)
echo "$UPDATED_CONFIG" > "$TEMP_FILE"

# Обновляем distribution
echo "🚀 Применение изменений..."
aws cloudfront update-distribution \
    --id "$DISTRIBUTION_ID" \
    --if-match "$ETAG" \
    --distribution-config "file://$TEMP_FILE" \
    > /dev/null

# Очищаем
rm "$TEMP_FILE"

echo "✅ Готово! CloudFront теперь будет возвращать index.html для 403/404 ошибок."
echo ""
echo "⏳ Изменения применятся через 5-10 минут (время деплоя CloudFront)."
echo "   Проверьте статус: aws cloudfront get-distribution --id $DISTRIBUTION_ID | jq '.Distribution.Status'"
