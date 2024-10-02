<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20240906101426 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        //$this->addSql('CREATE TABLE evaluations.evaluation (id INT AUTO_INCREMENT NOT NULL, fen VARCHAR(255) NOT NULL COLLATE `utf8mb4_bin`, evals VARCHAR(8192) NOT NULL, INDEX idx_evaluation_fen (fen), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        //$this->addSql('DROP TABLE evaluation');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        //$this->addSql('CREATE TABLE evaluation (id INT AUTO_INCREMENT NOT NULL, fen VARBINARY(255) NOT NULL, fen_vchar VARCHAR(255) CHARACTER SET utf8mb4 NOT NULL COLLATE `utf8mb4_bin`, evals VARCHAR(8192) CHARACTER SET utf8mb4 NOT NULL COLLATE `utf8mb4_unicode_ci`, INDEX idx_evaluation_fen (fen), INDEX idx_evaluation_fen_vchar (fen_vchar), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB COMMENT = \'\' ');
        //$this->addSql('DROP TABLE evaluations.evaluation');
    }
}
