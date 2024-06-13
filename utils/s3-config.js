const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { access_key, secret_key, bucket_region, bucket_name } = require("./config");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  credentials: {
    accessKeyId: access_key,
    secretAccessKey: secret_key,
  },
  region: bucket_region,
});
const Image_Link = async (Key) => {
  const getObjectParams = {
    Bucket: bucket_name,
    Key: Key,
  };
  const command = new GetObjectCommand(getObjectParams);
  const url = await getSignedUrl(s3, command, {
    expiresIn: 500000,
  });
  return url;
};

const UploadFile = async (Key, file) => {
  const params = {
    Bucket: bucket_name,
    Key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  const command = new PutObjectCommand(params);
  const imageresponse = await s3.send(command);
  if (imageresponse.$metadata.httpStatusCode == 200) {
    let url = await Image_Link(Key);
    return url;
  }
};


module.exports = { s3, Image_Link, UploadFile };
