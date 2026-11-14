-- Schema cho chat_app — đúng theo mục 2.4 / 3.2 báo cáo đồ án.
-- Chạy toàn bộ script này trong MySQL Workbench để tạo CSDL thật.

CREATE DATABASE IF NOT EXISTS chat_app CHARACTER SET utf8mb4;
USE chat_app;

CREATE TABLE Users (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    FullName VARCHAR(100) NOT NULL,
    Avatar VARCHAR(255),
    Email VARCHAR(100) UNIQUE,
    Phone VARCHAR(15),
    Status ENUM('online','offline') NOT NULL DEFAULT 'offline',
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Conversations (
    ConversationID INT AUTO_INCREMENT PRIMARY KEY,
    Type ENUM('direct','group') NOT NULL DEFAULT 'direct',
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ConversationMembers (
    ConversationID INT NOT NULL,
    UserID INT NOT NULL,
    JoinedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ConversationID, UserID),
    FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID) ON DELETE CASCADE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE TABLE Messages (
    MessageID INT AUTO_INCREMENT PRIMARY KEY,
    ConversationID INT NOT NULL,
    SenderID INT NOT NULL,
    Content TEXT,
    MessageType ENUM('text','image') NOT NULL DEFAULT 'text',
    SentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Status ENUM('pending','sent','delivered') NOT NULL DEFAULT 'sent',
    IsSynced BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID) ON DELETE CASCADE,
    FOREIGN KEY (SenderID) REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE TABLE Attachments (
    AttachmentID INT AUTO_INCREMENT PRIMARY KEY,
    MessageID INT NOT NULL,
    FileURL VARCHAR(255) NOT NULL,
    FileType VARCHAR(50) NOT NULL,
    FOREIGN KEY (MessageID) REFERENCES Messages(MessageID) ON DELETE CASCADE
);
