module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "aws-s3",
      providerOptions: {
        baseUrl: env("MEDIA_PUBLIC_URL", ""),
        rootPath: env("S3_ROOT_PATH", ""),
        s3Options: {
          credentials: {
            accessKeyId: env("S3_ACCESS_KEY", "minio-dev"),
            secretAccessKey: env("S3_SECRET_KEY", "change-this-minio-password")
          },
          region: env("S3_REGION", "us-east-1"),
          endpoint: env("S3_ENDPOINT", "http://127.0.0.1:9000"),
          forcePathStyle: env.bool("S3_FORCE_PATH_STYLE", true),
          params: { Bucket: env("S3_BUCKET", "modular-housing-dev"), ACL: undefined }
        }
      },
      actionOptions: { upload: {}, uploadStream: {}, delete: {} }
    }
  }
});
