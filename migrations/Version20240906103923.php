<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20240906103923 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        //$this->addSql('DROP INDEX idx_evaluation_fen_vchar ON evaluation');
        //$this->addSql('ALTER TABLE evaluation DROP fen_vchar, CHANGE fen fen VARCHAR(255) NOT NULL COLLATE `utf8mb4_bin`');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        //$this->addSql('ALTER TABLE evaluation ADD fen_vchar VARCHAR(255) NOT NULL COLLATE `utf8mb4_bin`, CHANGE fen fen VARBINARY(255) NOT NULL');
        //$this->addSql('CREATE INDEX idx_evaluation_fen_vchar ON evaluation (fen_vchar)');
    }
}
