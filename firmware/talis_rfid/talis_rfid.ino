#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

#include "secrets.h"  // copy secrets.example.h to secrets.h and fill it in

static const uint8_t PIN_RFID_RST  = 32;
static const uint8_t PIN_RFID_MOSI = 23;
static const uint8_t PIN_RFID_MISO = 19;
static const uint8_t PIN_RFID_SCK  = 18;
static const uint8_t PIN_RFID_SS   = 4;

MFRC522 mfrc522(PIN_RFID_SS, PIN_RFID_RST);

void sendScan(const String& uid) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, SUPABASE_URL "/rest/v1/scans");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");

  String body = "{\"uid\":\"" + uid + "\"}";
  int code = http.POST(body);
  Serial.print("Response code: ");
  Serial.println(code);
  http.end();
}

void setup() {
  Serial.begin(115200);
  SPI.begin(PIN_RFID_SCK, PIN_RFID_MISO, PIN_RFID_MOSI, PIN_RFID_SS);
  mfrc522.PCD_Init();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" connected!");
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  Serial.print("Scanned: ");
  Serial.println(uid);
  sendScan(uid);

  mfrc522.PICC_HaltA();
  delay(1500);
}
